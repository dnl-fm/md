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

	// Start server
	log.Printf("Starting server on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
