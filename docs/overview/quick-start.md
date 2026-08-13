---
title: 快速开始
description: 用最少步骤把无限画布跑起来
---

# 快速开始

如果你只是想先把项目跑起来，优先使用 Docker。

## Docker 启动

```bash
git clone git@github.com:tigerowo/infinite-canvas.git
cd infinite-canvas
cp .env.example .env
docker compose up -d
```

启动后访问：

```text
http://localhost:3000
```

默认管理员账号：

```text
用户名：admin
密码：.env 中的 ADMIN_PASSWORD
```

## 本地构建镜像启动

如果你需要基于当前源码本地构建镜像：

```bash
cp .env.example .env
docker compose -f docker-compose.local.yml up -d --build
```

## 首次使用建议

- 先打开右上角配置弹窗，填入自己的 `Base URL`、`API Key` 和模型名。
- 如果使用后台渠道模式，再去管理后台补充系统模型与渠道配置。
- 如果需要提示词仓库内容，可进入 `/admin/prompts` 拉取或同步。

## 说明

- 当前画布项目和“我的素材”主要保存在浏览器本地，不支持云同步。
- 本地直连模式下，AI API Key 保存在浏览器本地，并由前端直接请求 OpenAI 兼容接口。
