package app

import (
	"strconv"
	"strings"
)

func formatTokenAmount(amount int, decimals int) string {
	if decimals <= 0 {
		return strconv.Itoa(amount)
	}

	sign := ""
	value := amount
	if value < 0 {
		sign = "-"
		value = -value
	}

	scale := 1
	for i := 0; i < decimals; i++ {
		scale *= 10
	}

	whole := value / scale
	fraction := value % scale
	if fraction == 0 {
		return sign + strconv.Itoa(whole)
	}

	fractionText := strconv.Itoa(fraction)
	if len(fractionText) < decimals {
		fractionText = strings.Repeat("0", decimals-len(fractionText)) + fractionText
	}
	fractionText = strings.TrimRight(fractionText, "0")
	if fractionText == "" {
		return sign + strconv.Itoa(whole)
	}

	return sign + strconv.Itoa(whole) + "." + fractionText
}
