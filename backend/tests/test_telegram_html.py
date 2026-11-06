import pytest

from app.services.telegram_html import sanitize_telegram_html, visible_length


@pytest.mark.parametrize(
    "html",
    [
        "<b>bold</b>",
        "<i>italic</i>",
        "<u>under</u>",
        "<s>strike</s>",
        "<tg-spoiler>secret</tg-spoiler>",
        "<code>x = 1</code>",
        "<pre>block</pre>",
        "<blockquote>quoted</blockquote>",
        "<b>bold <i>and italic</i></b>",
        '<a href="https://example.com/a?b=1&amp;c=2">link</a>',
        "plain 🍺 text\nwith newline",
    ],
)
def test_allowed_markup_passes_through_unchanged(html):
    assert sanitize_telegram_html(html) == html


def test_special_characters_in_text_are_escaped():
    assert sanitize_telegram_html("1 &lt; 2 &amp; 3 &gt; 2") == "1 &lt; 2 &amp; 3 &gt; 2"
    assert sanitize_telegram_html("Tom & Jerry") == "Tom &amp; Jerry"


def test_unknown_tags_are_removed_but_text_is_kept():
    assert sanitize_telegram_html("<script>alert(1)</script>") == "alert(1)"
    assert sanitize_telegram_html("<div><span>hi</span></div>") == "hi"


def test_attributes_are_stripped_from_allowed_tags():
    assert sanitize_telegram_html('<b onclick="x()" class="y">hi</b>') == "<b>hi</b>"


@pytest.mark.parametrize(
    "href",
    ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,hi", "/relative", ""],
)
def test_links_with_unsafe_or_missing_href_lose_the_tag(href):
    assert sanitize_telegram_html(f'<a href="{href}">click</a>') == "click"


def test_link_without_href_loses_the_tag():
    assert sanitize_telegram_html("<a>click</a>") == "click"


def test_quotes_in_href_are_escaped():
    out = sanitize_telegram_html('<a href="https://x.y/?q=&quot;a&quot;">l</a>')
    assert out == '<a href="https://x.y/?q=&quot;a&quot;">l</a>'


def test_unclosed_tags_are_closed_and_stray_closers_dropped():
    assert sanitize_telegram_html("<b>open <i>both") == "<b>open <i>both</i></b>"
    assert sanitize_telegram_html("text</b> more") == "text more"


def test_misnested_tags_are_rebalanced():
    assert sanitize_telegram_html("<b>a<i>b</b>c</i>") == "<b>a<i>b</i></b>c"


def test_no_formatting_inside_code():
    assert sanitize_telegram_html("<code>a <b>b</b></code>") == "<code>a b</code>"


def test_br_becomes_newline():
    assert sanitize_telegram_html("a<br>b") == "a\nb"


def test_visible_length_ignores_tags_and_counts_entities_once():
    assert visible_length("<b>hi</b> &amp; you") == len("hi & you")


def test_visible_length_counts_utf16_units_like_telegram():
    # 🍺 is outside the BMP: two UTF-16 code units
    assert visible_length("🍺") == 2
