SUPABASE AUTH RATE LIMIT SETUP

The website cannot raise Supabase email limits by itself.
You must change this inside your Supabase Dashboard.

Recommended VCC testing/community settings:
1. Open Supabase
2. Go to Authentication
3. Go to Providers
4. Open Email
5. Turn OFF Confirm Email for testing/early launch
6. Go to Authentication > Rate Limits if available
7. Recommended:
   - Signup cooldown: 10 seconds
   - Email/signup rate limit: 100 per hour
   - OTP/email request limits: raise from default if available

If users still see: email rate limit exceeded
- wait 15-30 minutes
- use mobile data instead of same Wi-Fi
- avoid repeated test signups from same device/IP
