"""Whitelist sanitizer for Telegram Bot API HTML (parse_mode="HTML").

Anything that isn't a supported Telegram formatting tag is dropped (its text is
kept), all text is re-escaped, attributes are stripped except a safe link href,
and tags are re-balanced so Telegram never rejects the message as malformed.
"""

from html import escape
from html.parser import HTMLParser
from urllib.parse import urlsplit

TELEGRAM_MESSAGE_LIMIT = 4096

ALLOWED_TAGS = {"b", "i", "u", "s", "code", "pre", "blockquote", "a", "tg-spoiler"}
# Telegram does not allow formatting inside code blocks.
NO_NESTED_FORMATTING = {"code", "pre"}
SAFE_LINK_SCHEMES = {"http", "https"}


def _is_safe_href(href: str) -> bool:
    try:
        parts = urlsplit(href.strip())
    except ValueError:
        return False
    return parts.scheme.lower() in SAFE_LINK_SCHEMES and bool(parts.netloc)


class _Sanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.text: list[str] = []
        self.stack: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "br":
            self.handle_data("\n")
            return
        if tag not in ALLOWED_TAGS:
            return
        if any(open_tag in NO_NESTED_FORMATTING for open_tag in self.stack):
            return
        if tag == "a":
            href = dict(attrs).get("href") or ""
            if not _is_safe_href(href):
                return
            self.out.append(f'<a href="{escape(href.strip(), quote=True)}">')
        else:
            self.out.append(f"<{tag}>")
        self.stack.append(tag)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "br":
            self.handle_data("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag not in self.stack:
            return
        while self.stack:
            open_tag = self.stack.pop()
            self.out.append(f"</{open_tag}>")
            if open_tag == tag:
                break

    def handle_data(self, data: str) -> None:
        self.text.append(data)
        self.out.append(escape(data, quote=False))

    def finish(self) -> None:
        self.close()
        while self.stack:
            self.out.append(f"</{self.stack.pop()}>")


def _parse(html: str) -> _Sanitizer:
    parser = _Sanitizer()
    parser.feed(html)
    parser.finish()
    return parser


def sanitize_telegram_html(html: str) -> str:
    return "".join(_parse(html).out)


def visible_text(html: str) -> str:
    return "".join(_parse(html).text)


def visible_length(html: str) -> int:
    """Length as Telegram counts it: UTF-16 code units of the visible text."""
    return len(visible_text(html).encode("utf-16-le")) // 2
