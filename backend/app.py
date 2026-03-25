from flask import Flask, request, jsonify
from flask_cors import CORS
from chat.engine import answer_question
from chat.market import get_market_snapshot, is_market_question, format_market_context


def create_app(testing: bool = False) -> Flask:
    app = Flask(__name__)
    app.config["TESTING"] = testing
    CORS(app)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.post("/api/chat")
    def chat():
        body = request.get_json(silent=True) or {}
        query = body.get("query")
        if not query:
            return jsonify({"error": "query is required"}), 400

        ticker = body.get("ticker", "")
        context = body.get("context", "")

        if ticker and is_market_question(query):
            try:
                snapshot = get_market_snapshot(ticker)
                context = f"{format_market_context(snapshot)}\n\n{context}"
            except Exception:
                pass

        result = answer_question(query, context)
        return jsonify(result)

    @app.get("/api/market/<ticker>")
    def market(ticker):
        try:
            return jsonify(get_market_snapshot(ticker))
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return app


if __name__ == "__main__":
    create_app().run(port=5000, debug=True)
