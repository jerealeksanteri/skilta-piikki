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
    - 3x Bell: 40€
    - 3x Plum: 15€
    - 3x Orange: 15€
    - 3x Lemon: 7€
    - 3x Cherry: 4€
    - 2x matching: 1€ (return bet)

    Target RTP: ~92%
    """

    SYMBOLS = ["cherry", "lemon", "orange", "plum", "bell", "seven"]
    SYMBOL_WEIGHTS = [30, 25, 21, 15, 6, 3]  # Weights for each symbol

    PAYOUTS = {
        "cherry": 4.0,
        "lemon": 7.0,
        "orange": 15.0,
        "plum": 15.0,
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
            return_multiplier = 1.0
            return bet_amount * return_multiplier  # Return the bet

        # No match
        return 0.0

    @classmethod
    def get_theoretical_rtp(cls) -> float:
        """
        Calculate theoretical RTP (Return to Player) percentage.

        RTP is computed by direct enumeration of all possible outcomes, using
        the same `_calculate_payout` method as real spins. This guarantees the
        theoretical value always matches the actual payout logic: whenever the
        payout rules or symbol weights change, this calculation stays correct
        without manual updates to a hand-derived formula.

        Returns:
            RTP as a percentage (e.g., 92.12 for 92.12%)
        """
        total_weight = sum(cls.SYMBOL_WEIGHTS)
        probs = [w / total_weight for w in cls.SYMBOL_WEIGHTS]

        total_ev = 0.0
        for i, sym_i in enumerate(cls.SYMBOLS):
            for j, sym_j in enumerate(cls.SYMBOLS):
                for k, sym_k in enumerate(cls.SYMBOLS):
                    outcome_prob = probs[i] * probs[j] * probs[k]
                    payout = cls._calculate_payout(
                        [sym_i, sym_j, sym_k], cls.BET_AMOUNT
                    )
                    total_ev += outcome_prob * payout

        # RTP = (Expected return / Bet amount) * 100
        return (total_ev / cls.BET_AMOUNT) * 100


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
