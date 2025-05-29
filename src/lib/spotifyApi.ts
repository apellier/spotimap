// Spotify API Helper
export const callSpotifyApi = async (
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    accessToken: string,
    body?: Record<string, any>
) => {
    // ... (implementation from your uploaded file)
    const headers: HeadersInit = {
        'Authorization': `Bearer ${accessToken}`,
    };
    if (body && (method === 'POST' || method === 'PUT')) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, { // Assuming original URL was placeholder
        method: method,
        headers: headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        let errorDetails = `Spotify API Error: ${response.status} ${response.statusText}`;
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            try {
                const errorData = await response.json();
                if (errorData.error && errorData.error.message) {
                    errorDetails = errorData.error.message;
                    if (errorData.error.reason) {
                        errorDetails += ` (Reason: ${errorData.error.reason})`;
                    }
                } else if (typeof errorData === 'string') {
                    errorDetails = errorData;
                }
            } catch (e) {
                console.warn("Could not parse JSON from error response body.", e);
            }
        } else {
            try {
                const errorText = await response.text();
                if (errorText) {
                    errorDetails += ` - Response body: ${errorText.substring(0, 100)}${errorText.length > 100 ? '...' : ''}`;
                }
            } catch (textError) { /* ignore */ }
        }
        console.error("Spotify API Call Failed Details:", errorDetails, "Full Response Status:", response.status, "URL:", response.url);
        throw new Error(errorDetails);
    }
    if (response.status === 204 || response.status === 202) return null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) return response.json();
    return null;
};