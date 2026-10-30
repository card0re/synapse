package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// Токен чату більше не їде в адресі: Cloud Run пише повний адрес запиту в
// логи, тож ?token=... складав туди діючі ключі від акаунтів на 72 години.
func TestWSTokenComesFromHeaderNotURL(t *testing.T) {
	for _, tc := range []struct {
		name     string
		protocol string
		query    string
		want     string
	}{
		{"токен після мітки", "bearer, jwt.abc.def", "", "jwt.abc.def"},
		{"без пробілу", "bearer,jwt.abc.def", "", "jwt.abc.def"},
		{"сама лише мітка", "bearer", "", ""},
		{"заголовка немає", "", "", ""},

		// Головне: адреса більше не є джерелом токена.
		{"токен в адресі не приймається", "", "?token=jwt.abc.def", ""},
		{"заголовок сильніший за адресу", "bearer, from.header", "?token=from.url", "from.header"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/api/ws"+tc.query, nil)
			if tc.protocol != "" {
				r.Header.Set("Sec-WebSocket-Protocol", tc.protocol)
			}
			if got := wsToken(r); got != tc.want {
				t.Errorf("отримано %q, очікувалось %q", got, tc.want)
			}
		})
	}
}
