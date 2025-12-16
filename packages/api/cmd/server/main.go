package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/dnl-fm/md/packages/api/internal/handlers"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}

	// Initialize renderers
	log.Println("Initializing renderers...")
	if err := handlers.InitializeRenderers(); err != nil {
		log.Fatal("Failed to initialize renderers:", err)
	}
	defer handlers.CloseRenderers()
	log.Println("Renderers ready")

	// Initialize cloud database
	log.Println("Initializing cloud database...")
	handlers.InitCloudDB(dataDir)
	log.Println("Cloud database ready")

	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type"},
		ExposedHeaders:   []string{"X-Cache-Status"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Routes
	r.Get("/health", handlers.Health)
	r.Get("/render/mermaid/{theme}/{hash}", handlers.RenderMermaid)
	r.Get("/render/ascii/{hash}", handlers.RenderASCII)

	// Cloud sync routes (v1 API)
	r.Route("/v1/cloud", func(r chi.Router) {
		r.Get("/documents", handlers.ListDocuments)
		r.Post("/documents", handlers.CreateDocument)
		r.Get("/documents/{id}", handlers.GetDocument)
		r.Put("/documents/{id}", handlers.UpdateDocument)
		r.Delete("/documents/{id}", handlers.DeleteDocument)
	})

	// Start server
	log.Printf("Starting server on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
