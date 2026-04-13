package app

import (
	"encoding/json"
	"log"
	"net/http"
)

type appError struct {
	Code       string
	Message    string
	StatusCode int
}

func (e *appError) Error() string {
	return e.Message
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeAppError(w http.ResponseWriter, err *appError) {
	if err == nil {
		err = &appError{
			Code:       "INTERNAL_SERVER_ERROR",
			Message:    "Unexpected backend error.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	log.Printf("[app-error] status=%d code=%s message=%s", err.StatusCode, err.Code, err.Message)

	writeJSON(w, err.StatusCode, map[string]any{
		"code":    err.Code,
		"message": err.Message,
	})
}
