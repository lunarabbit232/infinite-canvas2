package router

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tigerowo/infinite-canvas/handler"
	"github.com/tigerowo/infinite-canvas/middleware"
)

func New() *gin.Engine {
	router := gin.Default()
	router.RedirectTrailingSlash = false
	_ = router.SetTrustedProxies(nil)
	api := router.Group("/api")
	authLimiter := middleware.RateLimit(20, time.Minute)
	genLimiter := middleware.RateLimit(60, time.Minute)
	api.GET("/health", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	api.GET("/healthz", gin.WrapF(handler.Healthz))
	api.POST("/auth/register", authLimiter, gin.WrapF(handler.Register))
	api.POST("/auth/login", authLimiter, gin.WrapF(handler.Login))
	api.GET("/auth/linux-do/authorize", gin.WrapF(handler.LinuxDoAuthorize))
	api.GET("/auth/linux-do/callback", gin.WrapF(handler.LinuxDoCallback))
	api.GET("/auth/me", middleware.OptionalAuth, gin.WrapF(handler.CurrentUser))
	api.GET("/settings", gin.WrapF(handler.Settings))
	api.GET("/storage/config", gin.WrapF(handler.StorageConfig))
	api.GET("/media/references/:id", func(c *gin.Context) {
		handler.ReferenceMedia(c.Writer, c.Request, c.Param("id"))
	})
	api.HEAD("/media/references/:id", func(c *gin.Context) {
		handler.ReferenceMedia(c.Writer, c.Request, c.Param("id"))
	})
	api.GET("/files/:id", func(c *gin.Context) {
		handler.FileInfo(c.Writer, c.Request, c.Param("id"))
	})
	api.GET("/files/:id/content", func(c *gin.Context) {
		handler.FileContent(c.Writer, c.Request, c.Param("id"))
	})
	v1 := api.Group("/v1", middleware.UserAuth)
	v1.POST("/images/generations", genLimiter, gin.WrapF(handler.AIImagesGenerations))
	v1.POST("/images/edits", genLimiter, gin.WrapF(handler.AIImagesEdits))
	v1.POST("/responses", genLimiter, gin.WrapF(handler.AIResponses))
	v1.POST("/chat/completions", genLimiter, gin.WrapF(handler.AIChatCompletions))
	v1.POST("/audio/speech", genLimiter, gin.WrapF(handler.AIAudioSpeech))
	v1.POST("/canvas/tasks/delete", gin.WrapF(handler.DeleteUserCanvasTasks))
	v1.POST("/canvas/image-tasks", gin.WrapF(handler.CreateCanvasImageTask))
	v1.GET("/canvas/image-tasks", gin.WrapF(handler.UserCanvasImageTasks))
	v1.POST("/canvas/image-tasks/status", gin.WrapF(handler.BatchCanvasImageTasks))
	v1.GET("/canvas/image-tasks/:id", func(c *gin.Context) {
		handler.GetCanvasImageTask(c.Writer, c.Request, c.Param("id"))
	})
	v1.DELETE("/canvas/image-tasks/:id", func(c *gin.Context) {
		handler.DeleteUserCanvasImageTask(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/canvas/audio-tasks", gin.WrapF(handler.CreateCanvasAudioTask))
	v1.GET("/canvas/audio-tasks/:id", func(c *gin.Context) {
		handler.GetCanvasAudioTask(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/ai-logs", gin.WrapF(handler.ClientAICallLog))
	v1.POST("/videos", genLimiter, gin.WrapF(handler.AIVideos))
	v1.POST("/videos/concat", gin.WrapF(handler.ConcatVideoClips))
	v1.POST("/videos/transition", gin.WrapF(handler.TransitionVideoClips))
	v1.POST("/videos/clip-by-url", gin.WrapF(handler.ClipVideoByURL))
	v1.POST("/videos/concat-by-url", gin.WrapF(handler.ConcatVideosByURL))
	v1.POST("/videos/transition-by-url", gin.WrapF(handler.TransitionVideosByURL))
	v1.GET("/video-tasks", gin.WrapF(handler.UserVideoTasks))
	v1.DELETE("/video-tasks/:id", func(c *gin.Context) {
		handler.DeleteUserVideoTask(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/video-tasks/:id/cancel", func(c *gin.Context) {
		handler.CancelUserVideoTask(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/video-tasks/:id/cache", func(c *gin.Context) {
		handler.CacheVideoTask(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/video-tasks/:id/clip", func(c *gin.Context) {
		handler.ClipVideoTask(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/tts/voices", gin.WrapF(handler.TTSVoices))
	v1.POST("/tts/synthesize", genLimiter, gin.WrapF(handler.TTSSynthesize))
	v1.POST("/media/references", gin.WrapF(handler.UploadReferenceMedia))
	v1.GET("/videos/:id", func(c *gin.Context) {
		handler.AIVideo(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/videos/:id/content", func(c *gin.Context) {
		handler.AIVideoContent(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/workflows", gin.WrapF(handler.UserWorkflows))
	v1.POST("/workflows", gin.WrapF(handler.SaveUserWorkflow))
	v1.POST("/workflows/agent-draft", gin.WrapF(handler.DraftUserWorkflow))
	v1.POST("/workflows/storyboard-draft", gin.WrapF(handler.DraftUserStoryboard))
	v1.POST("/workflows/execution-script", gin.WrapF(handler.GenerateUserExecutionScript))
	v1.POST("/workflows/director-draft", gin.WrapF(handler.DraftUserDirectorAdvice))
	v1.DELETE("/workflows/:id", func(c *gin.Context) {
		handler.DeleteUserWorkflow(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/storage/measure", gin.WrapF(handler.MeasureUserStorageProvider))
	v1.POST("/files", gin.WrapF(handler.UploadFile))
	v1.DELETE("/files/:id", func(c *gin.Context) {
		handler.DeleteFile(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/user-config", gin.WrapF(handler.UserConfig))
	v1.POST("/user-config/model", gin.WrapF(handler.SaveUserModelConfig))
	v1.POST("/user-config/storage", gin.WrapF(handler.SaveUserStorageProvider))
	v1.GET("/canvas/projects", gin.WrapF(handler.UserCanvasProjects))
	v1.POST("/canvas/projects", gin.WrapF(handler.SaveUserCanvasProject))
	v1.POST("/canvas/projects/sync", gin.WrapF(handler.SyncUserCanvasProjects))
	v1.POST("/canvas/projects/delete", gin.WrapF(handler.DeleteUserCanvasProjects))
	v1.POST("/canvas/projects/resolve-edges", gin.WrapF(handler.ResolveCanvasProjectEdges))
	v1.GET("/user-data/image-history", gin.WrapF(handler.UserImageHistory))
	v1.POST("/user-data/image-history", gin.WrapF(handler.SaveUserImageHistory))
	v1.GET("/generation-logs/videos", gin.WrapF(handler.UserVideoGenerationLogs))
	v1.POST("/generation-logs/videos", gin.WrapF(handler.SaveUserVideoGenerationLogs))
	v1.POST("/generation-logs/videos/delete", gin.WrapF(handler.DeleteUserVideoGenerationLogs))
	v1.DELETE("/generation-logs/videos/:id", func(c *gin.Context) {
		handler.DeleteUserVideoGenerationLog(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/generation-logs/images", gin.WrapF(handler.UserImageGenerationLogs))
	v1.POST("/generation-logs/images", gin.WrapF(handler.SaveUserImageGenerationLogs))
	v1.POST("/generation-logs/images/delete", gin.WrapF(handler.DeleteUserImageGenerationLogs))
	v1.DELETE("/generation-logs/images/:id", func(c *gin.Context) {
		handler.DeleteUserImageGenerationLog(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/user-data/assets", gin.WrapF(handler.UserAssetData))
	v1.POST("/user-data/assets", gin.WrapF(handler.SaveUserAssetData))
	v1.GET("/characters", gin.WrapF(handler.ListCharacters))
	v1.POST("/characters", gin.WrapF(handler.SaveCharacter))
	v1.DELETE("/characters/:id", func(c *gin.Context) {
		handler.DeleteCharacter(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/characters/generate-views", gin.WrapF(handler.GenerateCharacterViews))
	v1.POST("/characters/consistency", gin.WrapF(handler.CheckCharacterConsistency))
	v1.GET("/props", gin.WrapF(handler.ListProps))
	v1.POST("/props", gin.WrapF(handler.SaveProp))
	v1.DELETE("/props/:id", func(c *gin.Context) {
		handler.DeleteProp(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/roles/mentor", gin.WrapF(handler.SetMentor))
	v1.GET("/roles/chain", gin.WrapF(handler.GetRoleChain))
	v1.GET("/roles/mentees", gin.WrapF(handler.ListMentees))
	v1.GET("/knowledge/user", gin.WrapF(handler.ListUserKnowledge))
	v1.POST("/knowledge/user", gin.WrapF(handler.SaveUserKnowledge))
	v1.DELETE("/knowledge/user/:id", func(c *gin.Context) {
		handler.DeleteUserKnowledge(c.Writer, c.Request, c.Param("id"))
	})
	api.GET("/proxy-image", gin.WrapF(handler.ProxyImage))
	api.GET("/video-cache/:id", func(c *gin.Context) {
		handler.ServeCachedVideo(c.Writer, c.Request, c.Param("id"))
	})
	api.GET("/video-clip/:filename", func(c *gin.Context) {
		handler.ServeVideoClip(c.Writer, c.Request, c.Param("filename"))
	})
	api.GET("/prompts", middleware.OptionalAuth, gin.WrapF(handler.Prompts))
	api.POST("/prompts/search/semantic", middleware.OptionalAuth, gin.WrapF(handler.SearchSemanticPrompts))
	api.GET("/prompts/search/hybrid", middleware.OptionalAuth, gin.WrapF(handler.SearchHybridPrompts))
	api.GET("/tags", middleware.OptionalAuth, gin.WrapF(handler.TagTree))
	api.GET("/assets", middleware.OptionalAuth, gin.WrapF(handler.Assets))
	api.POST("/assets/search/semantic", middleware.OptionalAuth, gin.WrapF(handler.SearchSemanticAssets))
	api.POST("/assets/interrogate", middleware.OptionalAuth, gin.WrapF(handler.InterrogateImage))
	api.GET("/assets/prompts", middleware.OptionalAuth, gin.WrapF(handler.AssetPrompts))
	api.POST("/assets/prompts/bind", middleware.OptionalAuth, gin.WrapF(handler.BindPromptToAsset))
	api.POST("/assets/prompts/unbind", middleware.OptionalAuth, gin.WrapF(handler.UnbindPromptFromAsset))
	api.POST("/workflows/events", middleware.OptionalAuth, gin.WrapF(handler.RecordWorkflowEvent))
	api.POST("/workflows/events/batch", middleware.OptionalAuth, gin.WrapF(handler.BatchRecordWorkflowEvents))
	api.GET("/workflows/events", middleware.OptionalAuth, gin.WrapF(handler.ListWorkflowEvents))
	api.GET("/workflows/replay", middleware.OptionalAuth, gin.WrapF(handler.ReplayWorkflowEvents))
	api.POST("/workflows/evaluate-branch", gin.WrapF(handler.EvaluateWorkflowBranch))
	api.POST("/canvas/templates", middleware.OptionalAuth, gin.WrapF(handler.SaveCanvasTemplate))
	api.GET("/canvas/templates", middleware.OptionalAuth, gin.WrapF(handler.ListCanvasTemplates))
	api.GET("/canvas/templates/featured", middleware.OptionalAuth, gin.WrapF(handler.FeaturedTemplates))
	api.POST("/canvas/templates/favorite", middleware.OptionalAuth, gin.WrapF(handler.FavoriteCanvasTemplate))
	api.POST("/canvas/templates/instantiate", middleware.OptionalAuth, gin.WrapF(handler.InstantiateCanvasTemplate))
	api.DELETE("/canvas/templates/:id", middleware.OptionalAuth, func(c *gin.Context) {
		handler.DeleteCanvasTemplate(c.Writer, c.Request)
	})
	api.POST("/admin/login", authLimiter, gin.WrapF(handler.AdminLogin))

	admin := api.Group("/admin", middleware.AdminAuth)
	admin.GET("/users", gin.WrapF(handler.AdminUsers))
	admin.POST("/users", gin.WrapF(handler.AdminSaveUser))
	admin.POST("/users/:id/credits", func(c *gin.Context) {
		handler.AdminAdjustUserCredits(c.Writer, c.Request, c.Param("id"))
	})
	admin.DELETE("/users/:id", func(c *gin.Context) {
		handler.AdminDeleteUser(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/credit-logs", gin.WrapF(handler.AdminCreditLogs))
	admin.POST("/credit-logs", gin.WrapF(handler.AdminSaveCreditLog))
	admin.DELETE("/credit-logs/:id", func(c *gin.Context) {
		handler.AdminDeleteCreditLog(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/ai-logs", gin.WrapF(handler.AdminAICallLogs))
	admin.DELETE("/ai-logs", gin.WrapF(handler.AdminDeleteAICallLogs))
	admin.GET("/settings", gin.WrapF(handler.AdminSettings))
	admin.POST("/settings", gin.WrapF(handler.AdminSaveSettings))
	admin.POST("/settings/channel-models", gin.WrapF(handler.AdminChannelModels))
	admin.POST("/settings/channel-test", gin.WrapF(handler.AdminTestChannelModel))
	admin.POST("/storage/measure", gin.WrapF(handler.AdminMeasureStorageProvider))
	admin.GET("/prompt-categories", gin.WrapF(handler.AdminPromptCategories))
	admin.POST("/prompt-categories/sync", gin.WrapF(handler.AdminSyncPromptCategories))
	admin.POST("/prompt-categories/sync-all", gin.WrapF(handler.AdminSyncAllPromptCategories))
	admin.GET("/prompts", gin.WrapF(handler.AdminPrompts))
	admin.POST("/prompts", gin.WrapF(handler.AdminSavePrompt))
	admin.POST("/prompts/batch-delete", gin.WrapF(handler.AdminDeletePrompts))
	admin.DELETE("/prompts/:id", func(c *gin.Context) {
		handler.AdminDeletePrompt(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/assets", gin.WrapF(handler.AdminAssets))
	admin.POST("/assets", gin.WrapF(handler.AdminSaveAsset))
	admin.POST("/assets/upload", gin.WrapF(handler.AdminUploadAsset))
	admin.POST("/assets/batch", gin.WrapF(handler.AdminBatchImportAssets))
	admin.DELETE("/assets/:id", func(c *gin.Context) {
		handler.AdminDeleteAsset(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/knowledge", gin.WrapF(handler.ListKnowledgeEntries))
	admin.POST("/knowledge", gin.WrapF(handler.SaveKnowledgeEntry))
	admin.DELETE("/knowledge/:id", func(c *gin.Context) {
		handler.DeleteKnowledgeEntry(c.Writer, c.Request, c.Param("id"))
	})

	router.NoRoute(middleware.NotFoundJSON)

	return router
}
