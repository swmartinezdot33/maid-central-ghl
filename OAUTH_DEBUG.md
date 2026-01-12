# OAuth Installation Debugging Guide

## Issue: Redirected to Dashboard Instead of Callback

If you're being redirected back to your GHL agency dashboard after logging in during OAuth installation, this usually means:

1. **Redirect URI Mismatch** - The redirect URI in GHL Marketplace doesn't exactly match your callback URL
2. **Callback Not Being Called** - GHL isn't calling your callback endpoint

## Step 1: Verify Redirect URI Configuration

### In GHL Marketplace:
1. Go to: https://marketplace.gohighlevel.com/developer
2. Edit your app
3. Check the **Redirect URI** field
4. It MUST be exactly: `https://maidcentral.vercel.app/api/auth/oauth/callback`
   - No trailing slash
   - Must be HTTPS (not HTTP)
   - Must match exactly (case-sensitive)

### In Your App:
1. Check Vercel environment variable: `GHL_REDIRECT_URI`
2. It should be: `https://maidcentral.vercel.app/api/auth/oauth/callback`

### Test Your Callback URL:
Visit: `https://maidcentral.vercel.app/api/auth/oauth/test`

You should see a JSON response confirming the callback URL is accessible.

## Step 2: Check Vercel Logs

1. Go to your Vercel dashboard
2. Navigate to your project → **Deployments** → Latest deployment → **Functions** tab
3. Look for logs from `/api/auth/oauth/callback`
4. If you don't see ANY logs when trying to install, GHL isn't calling your callback

## Step 3: Verify OAuth Flow

### Expected Flow:
1. User clicks "Install via OAuth" → Goes to `/api/auth/oauth/authorize`
2. App redirects to: `https://marketplace.gohighlevel.com/oauth/chooselocation?...`
3. User selects location and authorizes
4. GHL redirects to: `https://maidcentral.vercel.app/api/auth/oauth/callback?code=...&locationId=...`
5. Your callback exchanges code for token
6. User is redirected to: `/setup?success=oauth_installed`

### What to Check:
- Are you seeing step 4? (Check browser URL after authorization)
- If yes, check Vercel logs for errors in the callback
- If no, the redirect URI is wrong in GHL Marketplace

## Step 4: Common Issues

### Issue: "Redirect URI Mismatch"
**Solution:** 
- Copy the exact URL from your Vercel environment variable
- Paste it into GHL Marketplace Redirect URI field
- Save and try again

### Issue: "Invalid Client"
**Solution:**
- Verify `GHL_CLIENT_ID` and `GHL_CLIENT_SECRET` are set correctly in Vercel
- Make sure there are no extra spaces or quotes

### Issue: Callback Returns 404
**Solution:**
- Verify the route exists: `app/api/auth/oauth/callback/route.ts`
- Check that the app is deployed to Vercel
- Try accessing: `https://maidcentral.vercel.app/api/auth/oauth/test`

### Issue: No locationId in Callback
**Solution:**
- GHL should pass `locationId` as a query parameter
- Check Vercel logs to see what parameters are received
- The callback will try multiple ways to get locationId

## Step 5: Manual Testing

1. **Test Callback Accessibility:**
   ```bash
   curl https://maidcentral.vercel.app/api/auth/oauth/test
   ```

2. **Check OAuth Initiation:**
   - Visit: `https://maidcentral.vercel.app/api/auth/oauth/authorize`
   - Should redirect to GHL OAuth page
   - Check browser console for any errors

3. **Monitor Network Tab:**
   - Open browser DevTools → Network tab
   - Try installing the app
   - Look for request to `/api/auth/oauth/callback`
   - Check the response/status code

## Step 6: Enable Debug Logging

The callback route now includes extensive logging. Check Vercel logs for:
- `[OAuth Callback] Received callback with params:`
- `[OAuth Callback] Token exchange successful`
- `[OAuth Callback] Using locationId:`

If you see errors, they'll be logged with `[OAuth Callback]` prefix.

## Still Not Working?

1. **Double-check Redirect URI:**
   - In GHL Marketplace: Must be exactly `https://maidcentral.vercel.app/api/auth/oauth/callback`
   - In Vercel env: Must match exactly
   - No trailing slashes, no extra characters

2. **Check App Distribution Settings:**
   - In GHL Marketplace, verify your app's distribution settings
   - Make sure it's set to allow installation for the account type you're using

3. **Try Different Browser:**
   - Sometimes browser extensions or settings can interfere
   - Try incognito/private mode

4. **Contact GHL Support:**
   - If redirect URI matches exactly and callback is accessible, contact GHL support
   - They can check if there are any issues on their end




