import random
from typing import FrozenSet, Set, Tuple
from enum import Enum


class RouletteBetType(Enum):
    STRAIGHT  = 'Straight'   # 1 number          — pays 35:1
    SPLIT     = 'Split'      # 2 adjacent numbers — pays 17:1
    STREET    = 'Street'     # 3 numbers in a row — pays 11:1
    CORNER    = 'Corner'     # 4 numbers (square) — pays  8:1
    SIX_LINE  = 'Six Line'   # 6 numbers (2 rows) — pays  5:1
    DOZEN     = 'Dozen'      # 12 numbers         — pays  2:1
    COLUMN    = 'Column'     # 12 numbers         — pays  2:1
    RED_BLACK = 'Red/Black'  # 18 numbers         — pays  1:1
    EVEN_ODD  = 'Even/Odd'   # 18 numbers         — pays  1:1
    LOW_HIGH  = 'Low/High'   # 18 numbers         — pays  1:1


class RouletteService:
    """
    Service for simulating a European roulette machine (single zero, 0-36).

    Numbers 1-36 are arranged in a 12x3 grid:
        col 1  col 2  col 3
    r1:   1      2      3
    r2:   4      5      6
    ...
    r12: 34     35     36
    """

    NUMBERS = list(range(0, 37))

    # Profit multipliers (stake is always returned on top of these on a win)
    PAYOUTS = {
        'Straight': 35,
        'Split':    17,
        'Street':   11,
        'Corner':    8,
        'Six Line':  5,
        'Dozen':     2,
        'Column':    2,
        'Red/Black': 1,
        'Even/Odd':  1,
        'Low/High':  1,
    }

    # --- pre-computed valid bet sets ---

    # Horizontal splits: n and n+1 share the same row  (n not in col 3, i.e. n%3 != 0)
    # Vertical splits:   n and n+3
    # Zero splits:       0 is adjacent to 1, 2, 3
    VALID_SPLITS: Set[FrozenSet] = (
        {frozenset({n, n + 1}) for n in range(1, 36) if n % 3 != 0}
        | {frozenset({n, n + 3}) for n in range(1, 34)}
        | {frozenset({0, 1}), frozenset({0, 2}), frozenset({0, 3})}
    )

    # Streets start at 1, 4, 7, ..., 34
    STREET_STARTS = set(range(1, 35, 3))

    # Corners: top-left n must not be in col 3 (n%3 != 0) and n+4 <= 36
    VALID_CORNERS: Set[FrozenSet] = {
        frozenset({n, n + 1, n + 3, n + 4})
        for n in range(1, 33)
        if n % 3 != 0
    }

    # Six-line starts at 1, 4, 7, ..., 31  (two consecutive streets)
    SIX_LINE_STARTS = set(range(1, 32, 3))

    # Real European roulette red numbers
    RED_NUMBERS = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}

    @staticmethod
    def get_color(number: int) -> str:
        if number == 0:
            return 'Green'
        return 'Red' if number in RouletteService.RED_NUMBERS else 'Black'

    @staticmethod
    def spin() -> Tuple[int, str]:
        number = random.choice(RouletteService.NUMBERS)
        return number, RouletteService.get_color(number)

    @staticmethod
    def calculate_payout(
        bet_type: RouletteBetType,
        bet_value: str,
        spin_result: Tuple[int, str],
        bet_amount: float,
    ) -> float:
        """
        Return total payout (stake + winnings) for a bet, or 0.0 on a loss.

        bet_value encoding per bet type:
          STRAIGHT  - "17"
          SPLIT     - "17,18"     (two numbers, comma-separated, any order)
          STREET    - "1"         (first number of the row: 1, 4, 7, ..., 34)
          CORNER    - "1,2,4,5"  (four numbers, comma-separated, any order)
          SIX_LINE  - "1"         (first number of the first row: 1, 4, ..., 31)
          DOZEN     - "1", "2", or "3"
          COLUMN    - "1", "2", or "3"
          RED_BLACK - "Red" or "Black"
          EVEN_ODD  - "Even" or "Odd"
          LOW_HIGH  - "Low" or "High"
        """
        number, color = spin_result
        won = False

        if bet_type == RouletteBetType.STRAIGHT:
            won = str(number) == bet_value

        elif bet_type == RouletteBetType.SPLIT:
            nums = frozenset(int(x) for x in bet_value.split(','))
            if nums not in RouletteService.VALID_SPLITS:
                raise ValueError(f"Invalid split: '{bet_value}' — numbers must be adjacent on the board")
            won = number in nums

        elif bet_type == RouletteBetType.STREET:
            start = int(bet_value)
            if start not in RouletteService.STREET_STARTS:
                raise ValueError(f"Invalid street start: '{bet_value}' — must be one of {sorted(RouletteService.STREET_STARTS)}")
            won = start <= number <= start + 2

        elif bet_type == RouletteBetType.CORNER:
            nums = frozenset(int(x) for x in bet_value.split(','))
            if nums not in RouletteService.VALID_CORNERS:
                raise ValueError(f"Invalid corner: '{bet_value}' — numbers must form a 2×2 square on the board")
            won = number in nums

        elif bet_type == RouletteBetType.SIX_LINE:
            start = int(bet_value)
            if start not in RouletteService.SIX_LINE_STARTS:
                raise ValueError(f"Invalid six-line start: '{bet_value}' — must be one of {sorted(RouletteService.SIX_LINE_STARTS)}")
            won = start <= number <= start + 5

        elif bet_type == RouletteBetType.DOZEN:
            dozen = int(bet_value)
            dozen_ranges = {1: range(1, 13), 2: range(13, 25), 3: range(25, 37)}
            won = number in dozen_ranges[dozen]

        elif bet_type == RouletteBetType.COLUMN:
            col = int(bet_value)  # 1, 2, or 3
            # col 1 → n%3==1, col 2 → n%3==2, col 3 → n%3==0
            won = number != 0 and (number % 3 == col % 3)

        elif bet_type == RouletteBetType.RED_BLACK:
            won = color == bet_value

        elif bet_type == RouletteBetType.EVEN_ODD:
            won = number != 0 and (
                (number % 2 == 0 and bet_value == 'Even') or
                (number % 2 != 0 and bet_value == 'Odd')
            )

        elif bet_type == RouletteBetType.LOW_HIGH:
            won = number != 0 and (
                (1 <= number <= 18 and bet_value == 'Low') or
                (19 <= number <= 36 and bet_value == 'High')
            )

        if won:
            return bet_amount * (RouletteService.PAYOUTS[bet_type.value] + 1)
        return 0.0

    @staticmethod
    def get_theoretical_rtp() -> float:
        """All standard European roulette bets share RTP = 36/37 ≈ 97.30%."""
        return (36 / 37) * 100


if __name__ == "__main__":
    print(f"Theoretical RTP: {RouletteService.get_theoretical_rtp():.2f}%")
    print("\nSimulating 1,000,000 spins...")

    total_bet = 0.0
    total_won = 0.0
    bet_amount = 10.0

    valid_splits     = list(RouletteService.VALID_SPLITS)
    valid_corners    = list(RouletteService.VALID_CORNERS)
    street_starts    = list(RouletteService.STREET_STARTS)
    six_line_starts  = list(RouletteService.SIX_LINE_STARTS)

    for _ in range(1_000_000):
        bet_type = random.choice(list(RouletteBetType))

        if bet_type == RouletteBetType.STRAIGHT:
            bet_value = str(random.randint(0, 36))
        elif bet_type == RouletteBetType.SPLIT:
            bet_value = ','.join(str(n) for n in random.choice(valid_splits))
        elif bet_type == RouletteBetType.STREET:
            bet_value = str(random.choice(street_starts))
        elif bet_type == RouletteBetType.CORNER:
            bet_value = ','.join(str(n) for n in sorted(random.choice(valid_corners)))
        elif bet_type == RouletteBetType.SIX_LINE:
            bet_value = str(random.choice(six_line_starts))
        elif bet_type == RouletteBetType.DOZEN:
            bet_value = str(random.randint(1, 3))
        elif bet_type == RouletteBetType.COLUMN:
            bet_value = str(random.randint(1, 3))
        elif bet_type == RouletteBetType.RED_BLACK:
            bet_value = random.choice(['Red', 'Black'])
        elif bet_type == RouletteBetType.EVEN_ODD:
            bet_value = random.choice(['Even', 'Odd'])
        elif bet_type == RouletteBetType.LOW_HIGH:
            bet_value = random.choice(['Low', 'High'])

        spin_result = RouletteService.spin()
        total_won += RouletteService.calculate_payout(bet_type, bet_value, spin_result, bet_amount)
        total_bet += bet_amount

    actual_rtp = (total_won / total_bet) * 100
    print(f"Actual RTP:  {actual_rtp:.2f}%")
    print(f"Total bet:   {total_bet:.2f}€")
    print(f"Total won:   {total_won:.2f}€")
    print(f"Net:         {total_won - total_bet:.2f}€")