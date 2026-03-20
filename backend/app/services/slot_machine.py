import random
from typing import Tuple, List


class SlotMachineService:
    """
    Slot machine service with configurable RTP (Return to Player).

    The slot machine has 3 reels with 6 different symbols:
    - Cherry (🍒)
    - Lemon (🍋)
    - Orange (🍊)
    - Plum (🍇)
    - Bell (🔔)
    - Seven (7️⃣)

    Payouts (for 1€ bet):
    - 3x Seven: 50€ (jackpot)
    - 3x Bell: 37€
    - 3x Plum: 22€
    - 3x Orange: 12€
    - 3x Lemon: 7€
    - 3x Cherry: 4€
    - 2x matching: 1€ (return bet)

    Target RTP: 90.09%
    """

    SYMBOLS = ["cherry", "lemon", "orange", "plum", "bell", "seven"]
    SYMBOL_WEIGHTS = [30, 25, 20, 15, 7, 3]  # Weights for each symbol

    PAYOUTS = {
        "cherry": 4.0,
        "lemon": 8.0,
        "orange": 15.0,
        "plum": 22.0,
        "bell": 40.0,
        "seven": 50.0,
    }

    BET_AMOUNT = 1.0

    @classmethod
    def spin(cls, bet_amount: float = BET_AMOUNT) -> Tuple[List[str], float]:
        """
        Spin the slot machine.

        Args:
            bet_amount: Amount to bet (default 1€)

        Returns:
            Tuple of (symbols, win_amount)
            - symbols: List of 3 symbols
            - win_amount: Amount won (0 if no win)
        """
        # Generate 3 random symbols using weighted selection
        symbols = random.choices(
            cls.SYMBOLS,
            weights=cls.SYMBOL_WEIGHTS,
            k=3
        )

        # Calculate payout
        win_amount = cls._calculate_payout(symbols, bet_amount)

        return symbols, win_amount

    @classmethod
    def _calculate_payout(cls, symbols: List[str], bet_amount: float) -> float:
        """
        Calculate payout based on symbols.

        Args:
            symbols: List of 3 symbols
            bet_amount: Amount bet

        Returns:
            Win amount
        """
        # Check for 3 matching symbols
        if symbols[0] == symbols[1] == symbols[2]:
            payout_multiplier = cls.PAYOUTS.get(symbols[0], 0)
            return payout_multiplier * bet_amount

        # Check for 2 matching symbols (return bet)
        if symbols[0] == symbols[1] or symbols[1] == symbols[2] or symbols[0] == symbols[2]:
            return_multiplier = 1.0  # Return bet (1€) + 1€ win = 2€
            return bet_amount * return_multiplier  # Return the bet

        # No match
        return 0.0

    @classmethod
    def get_theoretical_rtp(cls) -> float:
        """
        Calculate theoretical RTP (Return to Player) percentage.

        Returns:
            RTP as a percentage (e.g., 90.5 for 90.5%)
        """
        total_weight = sum(cls.SYMBOL_WEIGHTS)

        # Calculate expected value for 3 matching symbols
        ev_three_match = 0.0
        for i, symbol in enumerate(cls.SYMBOLS):
            prob = (cls.SYMBOL_WEIGHTS[i] / total_weight) ** 3
            payout = cls.PAYOUTS[symbol]
            ev_three_match += prob * payout

        # Calculate expected value for 2 matching symbols (return bet)
        ev_two_match = 0.0
        for i, symbol in enumerate(cls.SYMBOLS):
            p = cls.SYMBOL_WEIGHTS[i] / total_weight
            # Probability of exactly 2 matching:
            # - First two match, third doesn't: p^2 * (1-p)
            # - First and third match, second doesn't: p^2 * (1-p)
            # - Second and third match, first doesn't: p^2 * (1-p)
            # But we need to make sure we don't double count when all 3 match
            # For simplicity: 3 * p^2 * (1-p) gives exactly 2 matches
            prob_exactly_two = 3 * (p ** 2) * (1 - p)
            ev_two_match += prob_exactly_two * cls.BET_AMOUNT

        # Total expected value per spin
        total_ev = ev_three_match + ev_two_match

        # RTP = (Expected return / Bet amount) * 100
        rtp = (total_ev / cls.BET_AMOUNT) * 100

        return rtp


# For debugging/testing
if __name__ == "__main__":
    print(f"Theoretical RTP: {SlotMachineService.get_theoretical_rtp():.2f}%")
    print("\nSimulating 100,000 spins:")

    total_bet = 0.0
    total_won = 0.0

    for _ in range(100000):
        symbols, win = SlotMachineService.spin()
        total_bet += SlotMachineService.BET_AMOUNT
        total_won += win

    actual_rtp = (total_won / total_bet) * 100
    print(f"Actual RTP: {actual_rtp:.2f}%")
    print(f"Total bet: {total_bet:.2f}€")
    print(f"Total won: {total_won:.2f}€")
    print(f"Net: {total_won - total_bet:.2f}€")
