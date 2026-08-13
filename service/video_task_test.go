package service

import "testing"

func TestNormalizeVideoTaskStatus(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"completed", "completed"},
		{"Complete", "completed"},
		{"success", "completed"},
		{"succeeded", "completed"},
		{"failed", "failed"},
		{"FAIL", "failed"},
		{"error", "failed"},
		{"cancelled", "failed"},
		{"canceled", "failed"},
		{"running", "processing"},
		{"processing", "processing"},
		{"in_progress", "processing"},
		{"queued", "queued"},
		{"pending", "queued"},
		{"", "queued"},
		{"  ", "queued"},
		{"unknown", "unknown"},
		{"Done", "completed"},
		{"QUEUED", "queued"},
	}

	for _, tt := range tests {
		result := NormalizeVideoTaskStatus(tt.input)
		if result != tt.expected {
			t.Errorf("NormalizeVideoTaskStatus(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}
