import re
import yfinance as yf

MARKET_KEYWORDS = re.compile(
    r"\b(price|stock|share|market cap|p/e|pe ratio|52.week|"
    r"dividend|yield|eps|earnings per share|valuation)\b",
    re.IGNORECASE,
)


def is_market_question(query: str) -> bool:
    return bool(MARKET_KEYWORDS.search(query))


def get_market_snapshot(ticker: str) -> dict:
    info = yf.Ticker(ticker).info
    return {
        "ticker": ticker.upper(),
        "price": info.get("currentPrice"),
        "pe_ratio": info.get("trailingPE"),
        "market_cap": info.get("marketCap"),
        "52w_high": info.get("fiftyTwoWeekHigh"),
        "52w_low": info.get("fiftyTwoWeekLow"),
    }


def format_market_context(snapshot: dict) -> str:
    return (
        f"Current market data for {snapshot['ticker']}: "
        f"Price=${snapshot['price']}, P/E={snapshot['pe_ratio']}, "
        f"Market Cap=${snapshot['market_cap']:,}, "
        f"52w High=${snapshot['52w_high']}, 52w Low=${snapshot['52w_low']}"
    )
