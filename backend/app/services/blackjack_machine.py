from enum import Enum

class AceValue(Enum):
    LOW = 1
    HIGH = 11
    
class CardValue(Enum):
    ACE = AceValue.LOW
    TWO = 2
    THREE = 3
    FOUR = 4
    FIVE = 5
    SIX = 6
    SEVEN = 7
    EIGHT = 8
    NINE = 9
    TEN = 10
    JACK = 10
    QUEEN = 10
    KING = 10
    
class BlackjackSuit(Enum):
    HEARTS = "hearts"
    DIAMONDS = "diamonds"
    CLUBS = "clubs"
    SPADES = "spades"

class BlackjackCard:
    def __init__(self, suit: BlackjackSuit, value: CardValue):
        self.suit = suit
        self.value = value

    def __str__(self):
        return f"{self.value.name} of {self.suit.value}"
    
class BlackjackDeck:
    def __init__(self):
        self.cards = [BlackjackCard(suit, value) for suit in BlackjackSuit for value in CardValue]
        self.shuffle()

    def shuffle(self):
        import random
        random.shuffle(self.cards)

    def draw_card(self) -> BlackjackCard:
        if not self.cards:
            raise ValueError("Deck is empty")
        return self.cards.pop()
    
PLAYERS = 5

def calculate_hand_value(hand: list[BlackjackCard]) -> tuple[int, int]:
    """
    Calculate the value of a blackjack hand, accounting for Aces.

    Args:
        hand: List of BlackjackCard objects in the player's hand.
    Returns:
        A tuple of (low_value, high_value) where:
        - low_value counts all Aces as 1
        - high_value counts all Aces as 11 (if it doesn't cause a bust)
    """
    low_value = sum(card.value.value if card.value != CardValue.ACE else AceValue.LOW.value for card in hand)
    high_value = sum(card.value.value if card.value != CardValue.ACE else AceValue.HIGH.value for card in hand)
    
    # If counting Aces as 11 causes a bust, return the low value
    if high_value > 21:
        return low_value, low_value
    return low_value, high_value
 
if __name__ == "__main__":
    deck = BlackjackDeck()
    
    # Deal initial hands to players and dealer
    player_hands = {
        "Player 1": [deck.draw_card()],
        "Player 2": [deck.draw_card()],
        "Player 3": [deck.draw_card()],
        "Player 4": [deck.draw_card()],
    }
    
    # Dealer starts with one card
    dealer_hand = [deck.draw_card()]
    
    # Deal second card to each player and dealer
    for player, hand in player_hands.items():
        hand.append(deck.draw_card())

    # Dealer draws second card
    dealer_hand.append(deck.draw_card())
    
    # Iterate over player hands and calculate values, then print results
    for player, hand in player_hands.items():
        
        # Calculate hand value and print
        player_value: tuple[int, int] = calculate_hand_value(hand)
        print(f"{player}'s hand: {[str(card) for card in hand]} (Value: {player_value})")
    
    # Calculate dealer hand value and print
    dealer_value = calculate_hand_value(dealer_hand)
    print(f"Dealer's hand: {[str(card) for card in dealer_hand]} (Value: {dealer_value})")
    
        
        
        
        