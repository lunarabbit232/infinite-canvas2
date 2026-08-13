package service

import "testing"

func TestNormalizeStoryboard_ValidJSON(t *testing.T) {
	content := `{"title": "Test", "theme": "test", "scenes": [{"scene": 1, "location": "Test"}]}`
	result, warnings, err := normalizeStoryboard(content)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(warnings) > 0 {
		t.Errorf("expected no warnings, got %v", warnings)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	m, ok := result.(map[string]any)
	if !ok {
		t.Fatal("expected map[string]any")
	}
	if m["title"] != "Test" {
		t.Errorf("title = %v, want Test", m["title"])
	}
}

func TestNormalizeStoryboard_JSONWithMarkdownWrapper(t *testing.T) {
	content := "```json\n{\"title\": \"Wrapped\"}\n```"
	result, _, err := normalizeStoryboard(content)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	m := result.(map[string]any)
	if m["title"] != "Wrapped" {
		t.Errorf("title = %v, want Wrapped", m["title"])
	}
}

func TestNormalizeStoryboard_JSONWithTextBefore(t *testing.T) {
	content := "Here is the storyboard:\n{\"title\": \"Padded\"}"
	result, _, err := normalizeStoryboard(content)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	m := result.(map[string]any)
	if m["title"] != "Padded" {
		t.Errorf("title = %v, want Padded", m["title"])
	}
}

func TestNormalizeStoryboard_NoScenes(t *testing.T) {
	content := `{"title": "Test", "scenes": []}`
	_, warnings, err := normalizeStoryboard(content)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(warnings) == 0 {
		t.Error("expected warning for empty scenes")
	}
}

func TestNormalizeStoryboard_InvalidJSON(t *testing.T) {
	content := "not json at all"
	_, _, err := normalizeStoryboard(content)
	if err == nil {
		t.Error("expected error for non-JSON")
	}
}

func TestNormalizeStoryboard_ArrayJSON(t *testing.T) {
	content := `[{"scene": 1}]`
	result, _, err := normalizeStoryboard(content)
	if err != nil {
		t.Fatalf("expected no error for array, got %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
}
