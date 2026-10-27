"""Company calendar: non-working days for attendance percentage."""

from datetime import date

# Fixed company holidays by year. Weekend overlaps are handled by set membership
# (a day is non-working once whether it is Sunday, 2nd/4th Saturday, or both).
COMPANY_HOLIDAYS: dict[int, frozenset[date]] = {
    2026: frozenset(
        {
            date(2026, 1, 1),  # New Year
            date(2026, 1, 26),  # Republic Day
            date(2026, 2, 15),  # Maha Shivratri
            date(2026, 3, 4),  # Holi
            date(2026, 3, 31),  # Mahavir Jayanti
            date(2026, 4, 3),  # Good Friday
            date(2026, 5, 28),  # Id-ul-Zuha (Bakrid)
            date(2026, 6, 26),  # Muharram
            date(2026, 8, 15),  # Independence Day
            date(2026, 8, 28),  # Raksha Bandhan
            date(2026, 9, 4),  # Janmashtami
            date(2026, 9, 14),  # Ganesh Chaturthi
            date(2026, 10, 2),  # Mahatma Gandhi's Birthday
            date(2026, 10, 20),  # Dussehra
            date(2026, 11, 6),  # Dhanteras
            date(2026, 11, 7),  # Choti Diwali (Naraka Chaturdashi)
            date(2026, 11, 8),  # Lakshmi Puja (Main Diwali)
            date(2026, 11, 9),  # Govardhan Puja
            date(2026, 11, 10),  # Bhai Dooj
            date(2026, 12, 25),  # Christmas Day
        }
    ),
}


def is_listed_company_holiday(d: date) -> bool:
    """True if the date is on the company holiday calendar for that year."""
    return d in COMPANY_HOLIDAYS.get(d.year, frozenset())


def is_weekend_off(d: date) -> bool:
    """True for every Sunday and the 2nd & 4th Saturdays of the month."""
    if d.weekday() == 6:  # Sunday
        return True
    if d.weekday() == 5:  # Saturday
        saturday_ordinal = (d.day - 1) // 7 + 1
        return saturday_ordinal in (2, 4)
    return False


def is_non_working_day(d: date) -> bool:
    """
    Non-working days are excluded from attendance % denominator.
    Overlaps (holiday on Sunday / 2nd / 4th Saturday) count once.
    """
    return is_weekend_off(d) or is_listed_company_holiday(d)


def is_working_day(d: date) -> bool:
    return not is_non_working_day(d)
