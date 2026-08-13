package repository

import "github.com/tigerowo/infinite-canvas/model"

// ListTags 获取所有标签。
func ListTags() ([]model.Tag, error) {
	db, err := DB()
	if err != nil { return nil, err }
	var items []model.Tag
	err = db.Order("sort_order asc").Find(&items).Error
	return items, err
}

// ListTagSynonyms 获取所有同义词。
func ListTagSynonyms() ([]model.TagSynonym, error) {
	db, err := DB()
	if err != nil { return nil, err }
	var items []model.TagSynonym
	err = db.Find(&items).Error
	return items, err
}

// ListTagTree 获取标签树（一级 + 子标签 + 同义词）。
func ListTagTree() ([]model.TagTree, error) {
	tags, err := ListTags()
	if err != nil { return nil, err }
	syns, err := ListTagSynonyms()
	if err != nil { return nil, err }
	synMap := map[int64][]string{}
	for _, s := range syns { synMap[s.TagID] = append(synMap[s.TagID], s.Synonym) }

	var roots []model.TagTree
	childrenMap := map[int64][]model.Tag{}
	for _, t := range tags {
		if t.Level == 1 {
			roots = append(roots, model.TagTree{Tag: t, Synonyms: synMap[t.ID]})
		} else {
			childrenMap[t.ParentID] = append(childrenMap[t.ParentID], t)
		}
	}
	for i := range roots {
		roots[i].Children = childrenMap[roots[i].Tag.ID]
	}
	return roots, nil
}

// SeedTags 注入种子标签数据。
func SeedTags() error {
	db, err := DB()
	if err != nil { return err }
	var count int64
	db.Model(&model.Tag{}).Count(&count)
	if count > 0 { return nil } // 已有数据，不重复注入

	type seed struct {
		name, zh, cat string
		children      []string
		synonyms      []string
	}
	cats := []seed{
		{"subject","主体与角色","🎨 主体与角色",
			[]string{"portrait","full_body","close-up","animal","wildlife","object","product","vehicle","character","group"},
			[]string{"人物","主体","角色","人物肖像","全身照","特写","动物","野生动物","物品","产品","载具","人物角色","群像"}},
		{"scene","场景与环境","🌍 场景与环境",
			[]string{"nature","forest","ocean","mountain","sky","city","urban","street","architecture","interior","room","studio","fantasy","sci-fi","space","underwater","landscape","garden"},
			[]string{"自然","森林","海洋","山脉","天空","城市","街道","建筑","室内","工作室","幻想","科幻","太空","水下","风景","园林","户外"}},
		{"style","艺术风格","🖼️ 艺术风格",
			[]string{"oil_painting","watercolor","sketch","ink","digital_art","vector","pixel_art","3d_render","photorealistic","cinematic","vintage","black_and_white","cyberpunk","steampunk","surreal","minimalist","anime","illustration"},
			[]string{"油画","水彩","素描","水墨","数字艺术","矢量","像素","3D","写实","电影感","复古","黑白","赛博朋克","蒸汽朋克","超现实","极简","动画","插画","二次元"}},
		{"composition","构图与视角","📐 构图与视角",
			[]string{"wide_shot","medium_shot","close-up","extreme_close-up","eye_level","low_angle","high_angle","top_down","perspective","isometric","symmetrical","aerial"},
			[]string{"全景","中景","近景","特写","大特写","平视","仰视","俯视","鸟瞰","透视","等距","对称","航拍","广角"}},
		{"lighting","光照与色彩","💡 光照与色彩",
			[]string{"natural_lighting","studio_lighting","golden_hour","blue_hour","neon","dramatic","warm","cool","monochrome","vibrant","muted","pastel","backlight","soft_light"},
			[]string{"自然光","影棚光","黄金时刻","蓝调时刻","霓虹","戏剧光","暖色调","冷色调","单色","鲜艳","柔和","粉彩","背光","柔光"}},
		{"quality","质量与细节","✨ 质量与细节",
			[]string{"8k","4k","hd","highly_detailed","intricate","sharp_focus","masterpiece","best_quality","award_winning","professional","commercial"},
			[]string{"8K","4K","高清","高细节","精细","锐焦","杰作","最高质量","获奖作品","专业","商业"}},
	}

	for _, c := range cats {
		pid := int64(0)
		db.Raw("INSERT INTO tags (name, name_zh, level, category, sort_order) VALUES (?, ?, 1, ?, 0) RETURNING id", c.name, c.cat, c.cat).Scan(&pid)
		for i, ch := range c.children {
			db.Exec("INSERT INTO tags (name, name_zh, level, parent_id, category, sort_order) VALUES (?, ?, 2, ?, ?, ?)", ch, ch, pid, c.cat, i+1)
		}
		for _, s := range c.synonyms {
			db.Exec("INSERT INTO tag_synonyms (tag_id, synonym) VALUES (?, ?)", pid, s)
		}
	}
	return nil
}
