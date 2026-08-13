package service

import "testing"

func TestEscapeSSML(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"hello", "hello"},
		{"hello & world", "hello &amp; world"},
		{"a < b", "a &lt; b"},
		{"a > b", "a &gt; b"},
		{`he said "hi"`, "he said &quot;hi&quot;"},
		{"it's", "it&apos;s"},
		{"<speak>&\"'", "&lt;speak&gt;&amp;&quot;&apos;"},
		{"普通中文文本", "普通中文文本"},
		{"", ""},
	}

	for _, tt := range tests {
		result := escapeSSML(tt.input)
		if result != tt.expected {
			t.Errorf("escapeSSML(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestSynthesizeTTS_EmptyInput(t *testing.T) {
	_, err := SynthesizeTTS("", "")
	if err == nil {
		t.Error("expected error for empty text")
	}
	if err.Error() != "text is empty" {
		t.Errorf("expected 'text is empty', got %q", err.Error())
	}
}

func TestSynthesizeTTS_DefaultVoice(t *testing.T) {
	_, err := SynthesizeTTS("test", "")
	if err == nil {
		return
	}
	if err.Error() == "text is empty" {
		t.Error("non-empty text should not trigger empty error")
	}
}
