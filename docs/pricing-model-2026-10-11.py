import csv
import math
from pathlib import Path

plans = [("Starter", 9, 1000, 1), ("Pro", 29, 5000, 3), ("Growth", 79, 15000, 6), ("Scale", 199, 40000, 12)]
scenarios = [("base", 0.001), ("stress", 0.002), ("adverse", 0.004)]
rows = []
for name, price, credits, support in plans:
    for scenario, cost in scenarios:
        for utilization in (0.5, 1.0):
            fee = price * 0.06 + 0.40
            variable = credits * utilization * cost
            contribution = price - fee - variable - support
            rows.append([name, scenario, utilization, price, credits, round(fee, 2), round(variable, 2), support, round(contribution, 2), round(contribution / price * 100, 2)])
path = Path(__file__).with_name("pricing-sensitivity-2026-10-11.csv")
with path.open("w", newline="", encoding="utf-8") as output:
    writer = csv.writer(output)
    writer.writerow(["plan", "scenario", "allowance_utilization", "revenue_usd", "included_credits", "payment_fee_usd", "variable_cost_usd", "support_reserve_usd", "contribution_usd", "contribution_margin_percent"])
    writer.writerows(rows)
assert math.isclose(29 - (29 * .06 + .4) - 5000 * .001 - 3, 18.86)
assert math.isclose(20 * 18.86 - 100 - 580 * .15 - 5, 185.20)
for scenario, cost in scenarios[:2]:
    available = 29 - (29 * .06 + .4) - 5000 * cost - 3 - 29 * .15
    print(scenario, "Pro accounts to cover $100 fixed + $5 free pool:", math.ceil(105 / available))
print("Base Pro accounts including $1,000 founder pay:", math.ceil(1105 / (18.86 - 29 * .15)))
print("60-second 2-vCPU/2GB render + 24MB upload + two on-demand downloads:", round(60 * (2 * .00000772 + 2 * .00000386) + .024 * .05 + 2 * .024 * .15, 6))
print("Wrote", path)
