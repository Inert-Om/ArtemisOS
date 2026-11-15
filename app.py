import threading
import webview
from lunar_backend import create_app

app = create_app()

def start_flask():
    # Runs Flask explicitly on port 5000 so all standard server logs print to console
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)

if __name__ == "__main__":
    # Start Flask in a background daemon thread
    t = threading.Thread(target=start_flask)
    t.daemon = True
    t.start()

    # Point pywebview to the local server URL instead of passing the app object directly
    webview.create_window(
        "ArtemisOS — Lunar Landing Site Navigator",
        "http://127.0.0.1:5000",
        width=1366,
        height=820
    )
    webview.start()