"""
CLIP Embedding HTTP 微服务
文本 → 向量 / 图片 → 向量 / 图片反推提示词（标签匹配）
"""
import io
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

MODEL_NAME = "openai/clip-vit-base-patch32"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

model = None
processor = None

# 预定义美学标签（中英双语）
_AESTHETIC_TAGS = [
    "realistic photo, realistic photograph", "anime style, illustration",
    "oil painting, fine art", "watercolor painting",
    "sketch, pencil drawing", "digital art, cg artwork",
    "black and white, monochrome", "vivid colors, colorful",
    "warm lighting, golden hour, sunset", "cold lighting, blue tone, night",
    "portrait, close-up of a person", "landscape, scenery, nature",
    "cityscape, urban, architecture", "interior design, room",
    "food photography, cuisine", "animal, wildlife",
    "fantasy, magical, mythical", "sci-fi, futuristic, cyberpunk",
    "minimalist, simple composition", "detailed, intricate, complex",
    "dark moody atmosphere", "bright cheerful atmosphere",
    "vintage retro style", "modern contemporary style",
]

_tag_texts = []
_tag_embeddings = None


def _init_tags():
    global _tag_texts, _tag_embeddings
    _tag_texts = _AESTHETIC_TAGS
    inputs = processor(text=_tag_texts, return_tensors="pt", padding=True, truncation=True).to(DEVICE)
    with torch.no_grad():
        outputs = model.get_text_features(**inputs)
        if hasattr(outputs, "pooler_output"):
            features = outputs.pooler_output
        elif hasattr(outputs, "text_embeds"):
            features = outputs.text_embeds
        else:
            features = outputs
    _tag_embeddings = features / features.norm(dim=-1, keepdim=True)


def load_model():
    global model, processor
    model = CLIPModel.from_pretrained(MODEL_NAME, local_files_only=True).to(DEVICE)
    processor = CLIPProcessor.from_pretrained(MODEL_NAME, local_files_only=True)
    model.eval()
    print(f"CLIP model loaded on {DEVICE}")
    # _init_tags()  # CPU 上 22 条标签太慢，延迟到首次 interrogate 调用
    print(f"Ready (tags lazy-loaded)")


def text_embedding(texts: list[str]) -> list[list[float]]:
    inputs = processor(text=texts, return_tensors="pt", padding=True, truncation=True).to(DEVICE)
    with torch.no_grad():
        outputs = model.get_text_features(**inputs)
        if hasattr(outputs, "pooler_output"):
            features = outputs.pooler_output
        elif hasattr(outputs, "text_embeds"):
            features = outputs.text_embeds
        else:
            features = outputs
    features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().tolist()


def image_embedding(image_bytes: bytes) -> list[float]:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    inputs = processor(images=img, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        outputs = model.get_image_features(**inputs)
        if hasattr(outputs, "pooler_output"):
            features = outputs.pooler_output
        elif hasattr(outputs, "image_embeds"):
            features = outputs.image_embeds
        else:
            features = outputs
    features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().tolist()[0]


def interrogate_image(image_bytes: bytes) -> str:
    """使用 CLIP 标签匹配反推提示词。"""
    if _tag_embeddings is None:
        _init_tags()
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    inputs = processor(images=img, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        outputs = model.get_image_features(**inputs)
        if hasattr(outputs, "pooler_output"):
            img_features = outputs.pooler_output
        elif hasattr(outputs, "image_embeds"):
            img_features = outputs.image_embeds
        else:
            img_features = outputs
    img_features = img_features / img_features.norm(dim=-1, keepdim=True)
    similarity = (img_features @ _tag_embeddings.T).squeeze(0)
    scores = similarity.cpu().tolist()
    # 取 top 5 标签
    indexed = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
    top_tags = [_tag_texts[i] for i, _ in indexed[:5]]
    return ", ".join(top_tags)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            if self.path == "/embed/text":
                data = json.loads(body)
                texts = data.get("texts", [])
                if not texts:
                    self._json(400, {"error": "texts required"})
                    return
                vecs = text_embedding(texts)
                self._json(200, {"vectors": vecs})

            elif self.path == "/embed/image":
                vec = image_embedding(body)
                self._json(200, {"vector": vec})

            elif self.path == "/interrogate":
                prompt = interrogate_image(body)
                self._json(200, {"prompt": prompt})

            else:
                self._json(404, {"error": "not found"})

        except Exception as e:
            self._json(500, {"error": str(e)})

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"status": "ok", "device": DEVICE})
        else:
            self._json(404, {"error": "not found"})

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


if __name__ == "__main__":
    port = int(os.environ.get("EMBED_PORT", "8765"))
    load_model()
    server = HTTPServer(("127.0.0.1", port), Handler)
    print(f"Embedding service on :{port}")
    server.serve_forever()
