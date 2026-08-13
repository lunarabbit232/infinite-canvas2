package logger

import (
	"log"
)

// Infof / Warnf / Errorf 与 log.Printf 同签名，仅在消息前加级别标记，
// 便于按 [ERROR] / [WARN] / [INFO] 过滤日志。后续如需真结构化输出，只需改此包。
func Infof(format string, args ...any) {
	log.Printf("[INFO] "+format, args...)
}

func Warnf(format string, args ...any) {
	log.Printf("[WARN] "+format, args...)
}

func Errorf(format string, args ...any) {
	log.Printf("[ERROR] "+format, args...)
}
