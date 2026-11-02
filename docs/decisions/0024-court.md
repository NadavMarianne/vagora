# 0024: The court: judge, verdict, punisher, and consequences

**Date:** 2026-11-02 **Status:** Accepted

Builds on decisions 0022 (limits file) and 0023 (reports and cases). Items marked **Open** aren't decided yet.

## 1. The hearing
- **Text,** in the app, with **both sides present** at the scheduled time.
- The judge (an AI) reads the report and the bot's facts, then lets the accused speak. **Objections** are allowed.
- Each message has a **time limit**, long enough to make a full argument.
- If someone stalls, the judge can order **quiet** and move on to the verdict.
- The hearing ends when the judge has heard enough to decide, as in real life. **Open:** a cost cap per hearing.
- **A side that doesn't show up** is ruled on without them.
- If the AI is unavailable, the court is **postponed**. Nothing is ever decided unchecked.

## 2. The verdict
The judge decides, in this order:
1. **Guilty, not guilty, or dismissed.** In a case about a refused or missed punishment, a dismissal leaves the original punishment as it was (or closes the case if it was already done).
2. **A false accusation:** the judge may give the accuser a **counter punishment**, inside the same bounds and the accuser's limits file.
3. **Severity,** from the facts and the arguments. Late is softer than never, and repeats raise it.
4. **Swaps allowed** (section 5).
5. **The kind of consequence:**
   - **Lighter cases:** the judge may ask the accuser what they prefer: **coins** (only if the accused has enough, there's no debt), **a cut to the accused's allowance** for a while, or **a surprise**. Or the judge decides on its own if one clearly fits.
   - **Heavier cases:** the judge sends the case to **the punisher** (section 3).
- A punishment is a **new obligation the judge or punisher decides**, not something picked from a catalog. It runs like an order: a deadline, and refusing it opens a new case (decision 0023).

## 3. The punisher
- A second AI session, right after the court. A specialist in punishments, based on the severity, the accuser's wishes, and the accused's **limits file**.
- It talks **privately with the accuser** while the accused waits. The session should be short.
- It explains what's going on, offers examples that fit the severity, and asks what kinds of punishment the accuser prefers. Then they **negotiate together** to settle on the most fitting one.
- The result must stay inside the severity level and the limits file.
- The private conversation stays **sealed** until the reveal and is **deleted** after the case. The accused never sees it.

## 4. Shown or hidden
- The accuser and punisher also decide whether the punishment is **shown in court** or **hidden until the last moment**.
- A hidden punishment is **softer** than its level normally allows (how much softer: market setting). The judge may refuse hiding for punishments that need more preparation.
- A punishment with swaps can't be hidden, because swaps happen in court.
- **Open:** how long before the deadline "the last moment" is.

## 5. Severity and swaps
- **Severity** is a number from 1 to 10, grouped into **low**, **middle**, and **high**. **Open:** the default boundaries, and whether a clean stretch of time lowers the repeat count.
- **A swap** replaces a punishment with a different one of the **same harshness** that the person prefers. The judge checks it's really the same.
- The judge decides how many swaps a case allows, from 0 up to the market's maximum (market setting). With 0, the punishment is final.
- **Swaps can only be used during court.**

## 6. The backstop
- Applies when someone refuses or misses a punishment that is **already at the maximum severity**, so there's nothing higher left.
- Market setting: an **allowance cut** for N weeks, a **spending freeze** for N weeks, or both. The freeze stops saved coins from dodging the cut. It should cost more than the worst punishment is "worth".
- It **closes the order**, so the ladder ends.
- **Open:** defaults, and a cap when backstops stack.
- There's no mercy step in between. The way out is refusing, taking the backstop, then leaving.

## 7. Stop
- Market setting. When on, any member can stop any order at any time: a full refund, no penalty, no mark on the record. When off, refusing always follows the ladder above.
- On by default for new markets.
- The app records obligations but never forces anything. The only things it enforces itself are coins, allowances, and spending.

## 8. The AI
- **Three roles:** the **bot** (checks facts), the **judge** (hears the case), and the **punisher** (decides punishments). All are checked against the limits files and severity bounds.
- **An AI is the only judging system for now.** The market picks it when it's created. A member acting as judge is a future idea.
- **The model** is chosen later. It must handle whatever a market's members discuss without refusing. Ideally it runs without anyone's computer having to be on, even if it costs a little.
- **Privacy:** what's said in court leaves our servers for the model. Keep it to the minimum, delete the punisher's conversations after each case, and say clearly in the app where it goes.
- Reports and the court are built together with the AI.

## Later
Appeals, a human judge, a member acting as judge.
