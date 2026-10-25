# Still Here

The website for *Still Here*, a true story by Nathan Droguett (Sydney, 2006 to 2016).
34 chapters, each with its own photos, videos and pull quotes.

## What's in here

```
index.html          coming-soon page (the front door while the site is in testing)
assets/             coming-soon background
home/               the real home page, with its photos and hero video
chapter-01/ … chapter-34/
  index.html        the chapter
  assets/           that chapter's photos and videos
support/            the Support Still Here page
unlock/             where buyers land after paying: they sign in by email link here
assets/stillhere-access.js   sign-in, unlocking chapters, and the Stripe buttons
404.html            "page not found", with the full chapter list
robots.txt          asks search engines to stay away while testing
.nojekyll           tells GitHub Pages to serve the files exactly as they are
```

Every page is plain HTML and CSS with a little JavaScript. There's no build step and nothing to install.

## Putting it live on GitHub Pages

1. Push this folder to a new GitHub repository.
2. In the repo, go to **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, pick `main` and `/ (root)`, then save.
3. After a minute or two the site is live at `https://<your-username>.github.io/<repo-name>/`.

All links between pages are relative, so they work at that address or on your own domain.

**404 page:** `404.html` has a line `<base href="/">`. Leave it if you use a custom domain. On the plain `github.io/<repo-name>/` address, change it to `<base href="/<repo-name>/">`.

## Testing mode (the coming-soon lock)

While testing, every page sends visitors back to the coming-soon page. Testers get in by tapping the full stop after "every word of it true" and entering the PIN. Their browser remembers it, so they only type it once. A shared link to a chapter goes to the coming-soon page first, then straight to that chapter after the PIN.

From the `Still Here - New` folder:

```
python3 _Tools/preview_gate.py on --pin 123456   # change the PIN (logs everyone out)
python3 _Tools/preview_gate.py off               # unlock everything for launch
```

This keeps casual visitors and search engines out. It is not real security: the files are public on GitHub, and someone technical could get around it. (The paid chapters are different: their text isn't on GitHub at all.)

## How the paid chapters work

Chapters 1 to 10 are on this site in full. For Chapters 11 to 34, only the title, photos and videos are here. The words live in a private Supabase storage bucket, outside GitHub.

1. A reader buys the book through Stripe and lands on `/unlock/`.
2. They enter their email and get a sign-in link. Tapping it signs them in on that device.
3. Stripe has already told Supabase about the payment (the `stripe-webhook` function saves it in the `purchases` table).
4. On any chapter from 11 on, the page asks Supabase for that chapter's text. Supabase only hands it over if the signed-in email has bought the book.

New phone or laptop? They tap "Already bought it?" on any locked chapter and sign in again with the same email.

**Test or real money:** near the top of `assets/stillhere-access.js` is `STRIPE_MODE = 'test'`. Change it to `'live'` when you're ready to take real payments.

## Before going public

- **Keep private material out.** Unused and unredacted photos live in `_Website-unused`, and the paid chapter text in `_Private`, both outside this folder. Never copy them in here.
- **The "Keep me posted" sign-up forms are still preview only.** They don't save anything yet.
- **Photos are WebP.** The original JPEGs are kept in `_Website-jpg` (outside this folder), so nothing is lost and you only upload the light versions.
- **At launch:** run `preview_gate.py off`, switch `STRIPE_MODE` to `'live'`, and swap `index.html` for the home page (or ask Claude to).

## Updating pages

If a page is re-exported from the Claude previews, run these from the `Still Here - New` folder before pushing:

```
python3 _Tools/export_for_github.py   # turns preview links into relative links
python3 _Tools/optimize_images.py     # makes WebP photos, moves the original JPEGs to _Website-jpg
python3 _Tools/protect_chapters.py    # moves Chapter 11 to 34 text into _Private (then upload it to Supabase)
python3 _Tools/preview_gate.py on     # re-applies the testing lock
python3 _Tools/check_links.py         # checks every link, photo and video
```
