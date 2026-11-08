from decimal import Decimal


def test_star_and_unstar(make_user, make_product, client_as):
    alice = make_user("Alice")
    beer = make_product("Beer", Decimal("2.00"))
    cider = make_product("Cider", Decimal("3.00"))
    client = client_as(alice)
    assert client.get("/api/favourites").json() == []

    assert client.put(f"/api/favourites/{cider.id}").json() == [cider.id]
    assert client.put(f"/api/favourites/{beer.id}").json() == [beer.id, cider.id]
    assert client.put(f"/api/favourites/{beer.id}").json() == [beer.id, cider.id]  # starring twice is fine
    assert client.delete(f"/api/favourites/{cider.id}").json() == [beer.id]
    assert client.delete(f"/api/favourites/{cider.id}").json() == [beer.id]  # so is unstarring twice


def test_favourites_are_per_member(make_user, make_product, client_as):
    alice = make_user("Alice")
    bob = make_user("Bob")
    beer = make_product("Beer", Decimal("2.00"))

    client_as(alice).put(f"/api/favourites/{beer.id}")

    assert client_as(bob).get("/api/favourites").json() == []
    assert client_as(alice).get("/api/favourites").json() == [beer.id]


def test_unknown_product(make_user, client_as):
    assert client_as(make_user("Alice")).put("/api/favourites/999").status_code == 404


def test_pending_members_cannot_use_favourites(make_user, make_product, client_as):
    beer = make_product("Beer", Decimal("2.00"))
    pending = make_user("New", is_active=False)

    assert client_as(pending).put(f"/api/favourites/{beer.id}").status_code == 403
