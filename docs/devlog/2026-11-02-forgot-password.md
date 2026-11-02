# 2026-11-02: Forgot password

- Forgot my own password, and found the app had no way to reset it.
- Learned no app can show a forgotten password: Firebase keeps only a one-way fingerprint of it. The phone's password manager can remember it instead.
- Added "Forgot password?" to the login screen. It sends Firebase's reset email to the address typed above it. Firebase allows choosing the same password again, and we add no rule against it.
