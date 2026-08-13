package service

import (
	"context"

	"github.com/tigerowo/infinite-canvas/model"
)

type userContextKey struct{}

func WithUser(ctx context.Context, user model.AuthUser) context.Context {
	return context.WithValue(ctx, userContextKey{}, user)
}

func UserFromContext(ctx context.Context) (model.AuthUser, bool) {
	user, ok := ctx.Value(userContextKey{}).(model.AuthUser)
	return user, ok
}
