# Robots.txt 合規性文檔

本文檔記錄目標網站的 `robots.txt` 規則和使用條款，確保爬蟲行為合規。

> **重要**：在開始爬蟲前，必須仔細閱讀並遵守每個網站的規則。

---

## 📋 目標網站 Robots.txt 記錄

### 1. OpenRice（開飯喇）

**網站**：https://www.openrice.com  
**Robots.txt**：https://www.openrice.com/robots.txt  
**最後檢查日期**：2025-12-09 21:57

#### Robots.txt 規則

```
User-Agent: GPTBot
Disallow: /

User-Agent: PerplexityBot
Disallow: /

User-Agent: meta-externalagent
Disallow: /

User-Agent: Bytespider
Disallow: /

User-Agent: *
Disallow: /service/
Disallow: /service2/
Disallow: /webservice/
Disallow: /myopenrice/addbookrestaurant.htm
Disallow: /stat/
Disallow: /stats/
Disallow: /big5/
Disallow: /info/ptvapp/
Disallow: /restaurant/report.htm
Disallow: /restaurant/report/
Disallow: /reports/
Disallow: /restaurant/mapreport.htm
Disallow: /restaurant/write.htm
Disallow: /review/write
Disallow: /restaurant/similar.htm
Disallow: /restaurant/EmailFriendmode.htm
Disallow: /restaurant/flagreview.htm
Disallow: /restaurant/comment.htm
Disallow: /restaurant/apicomments.htm
Disallow: /restaurant/dbsoffer.htm
Disallow: /restaurant/recipe.htm
Disallow: /restaurant/userinfo.htm
Disallow: /gourmet/
Disallow: /zh/restaurant/report.htm
Disallow: /zh/restaurant/report/
Disallow: /zh/reports/
Disallow: /zh/restaurant/mapreport.htm
Disallow: /zh/restaurant/write.htm
Disallow: /zh/review/write
Disallow: /zh/restaurant/similar.htm
Disallow: /zh/restaurant/EmailFriendmode.htm
Disallow: /zh/restaurant/flagreview.htm
Disallow: /zh/restaurant/comment.htm
Disallow: /zh/restaurant/apicomments.htm
Disallow: /zh/restaurant/dbsoffer.htm
Disallow: /zh/restaurant/recipe.htm
Disallow: /zh/restaurant/userinfo.htm
Disallow: /zh/gourmet/
Disallow: /zh-cn/restaurant/report.htm
Disallow: /zh-cn/restaurant/report/
Disallow: /zh-cn/reports/
Disallow: /zh-cn/restaurant/mapreport.htm
Disallow: /zh-cn/restaurant/write.htm
Disallow: /zh-cn/review/write
Disallow: /zh-cn/restaurant/similar.htm
Disallow: /zh-cn/restaurant/EmailFriendmode.htm
Disallow: /zh-cn/restaurant/flagreview.htm
Disallow: /zh-cn/restaurant/comment.htm
Disallow: /zh-cn/restaurant/apicomments.htm
Disallow: /zh-cn/restaurant/dbsoffer.htm
Disallow: /zh-cn/restaurant/recipe.htm
Disallow: /zh-cn/restaurant/userinfo.htm
Disallow: /zh-cn/gourmet/
Disallow: /en/restaurant/report.htm
Disallow: /en/restaurant/report/
Disallow: /en/reports/
Disallow: /en/restaurant/mapreport.htm
Disallow: /en/restaurant/write.htm
Disallow: /en/review/write
Disallow: /en/restaurant/similar.htm
Disallow: /en/restaurant/EmailFriendmode.htm
Disallow: /en/restaurant/flagreview.htm
Disallow: /en/restaurant/comment.htm
Disallow: /en/restaurant/apicomments.htm
Disallow: /en/restaurant/dbsoffer.htm
Disallow: /en/restaurant/recipe.htm
Disallow: /en/restaurant/userinfo.htm
Disallow: /en/gourmet/
```

**解讀**：

- ✅ 允許爬取主頁面和餐廳列表頁（未明確禁止）
- ❌ 禁止爬取 `/service/`, `/service2/`, `/webservice/` 等服務端點
- ❌ 禁止爬取 `/restaurant/report/`, `/restaurant/write.htm` 等用戶操作頁面
- ❌ 禁止爬取 `/review/write` 等評論撰寫頁面
- ❌ 禁止爬取 `/gourmet/` 路徑
- ⚠️ 未明確禁止餐廳詳情頁，但需謹慎使用
- ⚠️ 未明確設置 `Crawl-delay`，建議使用 3-5 秒

**建議**：

- 使用 `User-agent: *` 或標註為學習用途
- 請求間隔設置為 3-5 秒（保守策略）
- 避免爬取被明確禁止的路徑
- 重點關注餐廳列表和詳情頁（如果允許）

#### 服務條款（ToS）

**關鍵條款**：

- 禁止自動化訪問（需要確認）
- 禁止商業用途
- 尊重版權

**合規措施**：

- ✅ 僅用於學習和研究目的
- ✅ 標註為學習用途
- ✅ 不進行商業用途
- ⚠️ 需要確認是否允許自動化訪問

---

### 2. Google Maps

**網站**：https://www.google.com/maps  
**Robots.txt**：https://www.google.com/robots.txt  
**最後檢查日期**：2025-12-09 21:58

#### Robots.txt 規則

```
User-agent: *
User-agent: Yandex
Disallow: /search
Allow: /search/about
Allow: /search/howsearchworks
Disallow: /sdch
Disallow: /groups
Disallow: /index.html?
Disallow: /?
Allow: /?hl=
Disallow: /?hl=*&
Allow: /?hl=*&gws_rd=ssl$
Disallow: /?hl=*&*&gws_rd=ssl
Allow: /?gws_rd=ssl$
Allow: /?pt1=true$
Disallow: /imgres
Disallow: /u/
Disallow: /setprefs
Disallow: /m?
Disallow: /m/
Allow:    /m/finance
Disallow: /wml?
Disallow: /wml/?
Disallow: /wml/search?
Disallow: /xhtml?
Disallow: /xhtml/?
Disallow: /xhtml/search?
Disallow: /xml?
Disallow: /imode?
Disallow: /imode/?
Disallow: /imode/search?
Disallow: /jsky?
Disallow: /jsky/?
Disallow: /jsky/search?
Disallow: /pda?
Disallow: /pda/?
Disallow: /pda/search?
Disallow: /sprint_xhtml
Disallow: /sprint_wml
Disallow: /pqa
Disallow: /gwt/
Disallow: /purchases
Disallow: /local?
Disallow: /local_url
Disallow: /shihui?
Disallow: /shihui/
Disallow: /products?
Disallow: /product_
Disallow: /products_
Disallow: /products;
Disallow: /print
Disallow: /books/
Disallow: /bkshp?*q=
Disallow: /books?*q=
Disallow: /books?*output=
Disallow: /books?*pg=
Disallow: /books?*jtp=
Disallow: /books?*jscmd=
Disallow: /books?*buy=
Disallow: /books?*zoom=
Allow: /books?*q=related:
Allow: /books?*q=editions:
Allow: /books?*q=subject:
Allow: /books/about
Allow: /books?*zoom=1
Allow: /books?*zoom=5
Allow: /books/content?*zoom=1
Allow: /books/content?*zoom=5
Disallow: /patents?
Disallow: /patents/download/
Disallow: /patents/pdf/
Disallow: /patents/related/
Disallow: /scholar
Disallow: /citations?
Allow: /citations?user=
Disallow: /citations?*cstart=
Allow: /citations?view_op=new_profile
Allow: /citations?view_op=top_venues
Allow: /scholar_share
Disallow: /s?
Disallow: /maps?
Allow: /maps?daddr=
Allow: /maps?entry=wc
Allow: /maps?f=
Allow: /maps?hl=
Allow: /maps?q=
Allow: /maps?saddr=
Allow: /maps?sid=
Allow: /maps?*output=classic
Allow: /maps?*file=
Disallow: /mapstt?
Disallow: /mapslt?
Disallow: /mapabcpoi?
Disallow: /maphp?
Disallow: /mapprint?
Disallow: /maps/
Allow: /maps/$
Allow: /maps/@
Allow: /maps/?daddr=
Allow: /maps/?entry=wc
Allow: /maps/?f=
Allow: /maps/?hl=
Allow: /maps/?q=
Allow: /maps/?saddr=
Allow: /maps/?sid=
Allow: /maps/search/
Allow: /maps/sitemap.xml
Allow: /maps/sitemaps/
Allow: /maps/dir/
Allow: /maps/d/
Allow: /maps/reserve
Allow: /maps/about
Allow: /maps/contrib/
Allow: /maps/match
Allow: /maps/place/
Allow: /maps/_/
Allow: /search?*tbm=map
Allow: /maps/vt?
Allow: /maps/preview
Disallow: /maps/api/js/
Allow: /maps/api/js
Disallow: /mld?
Disallow: /staticmap?
Disallow: /help/maps/streetview/partners/welcome/
Disallow: /help/maps/indoormaps/partners/
Disallow: /lochp?
Disallow: /ie?
Disallow: /uds/
Disallow: /transit?
Disallow: /trends?
Disallow: /trends/music?
Disallow: /trends/hottrends?
Disallow: /trends/viz?
Disallow: /trends/embed.js?
Disallow: /trends/fetchComponent?
Disallow: /trends/beta
Disallow: /trends/topics
Disallow: /trends/explore?
Disallow: /trends/embed
Disallow: /trends/api
Disallow: /musica
Disallow: /musicad
Disallow: /musicas
Disallow: /musicl
Disallow: /musics
Disallow: /musicsearch
Disallow: /musicsp
Disallow: /musiclp
Disallow: /urchin_test/
Disallow: /movies?
Disallow: /wapsearch?
Disallow: /reviews/search?
Disallow: /orkut/albums
Disallow: /cbk
Disallow: /recharge/dashboard/car
Disallow: /recharge/dashboard/static/
Disallow: /profiles/me
Disallow: /s2/profiles/me
Allow: /s2/profiles
Allow: /s2/oz
Allow: /s2/photos
Allow: /s2/search/social
Allow: /s2/static
Disallow: /s2
Disallow: /transconsole/portal/
Disallow: /gcc/
Disallow: /aclk
Disallow: /tbproxy/
Disallow: /imesync/
Disallow: /shenghuo/search?
Disallow: /support/forum/search?
Disallow: /reviews/polls/
Disallow: /hosted/images/
Disallow: /ppob/?
Disallow: /ppob?
Disallow: /accounts/ClientLogin
Disallow: /accounts/ClientAuth
Disallow: /accounts/o8
Allow: /accounts/o8/id
Disallow: /topicsearch?q=
Disallow: /xfx7/
Disallow: /squared/api
Disallow: /squared/search
Disallow: /squared/table
Disallow: /qnasearch?
Disallow: /sidewiki/entry/
Disallow: /quality_form?
Disallow: /labs/popgadget/search
Disallow: /compressiontest/
Disallow: /analytics/feeds/
Disallow: /analytics/partners/comments/
Disallow: /analytics/portal/
Disallow: /analytics/uploads/
Allow: /alerts/manage
Allow: /alerts/remove
Disallow: /alerts/
Allow: /alerts/$
Disallow: /phone/compare/?
Disallow: /travel/clk
Disallow: /travel/entity
Disallow: /travel/search
Disallow: /travel/flights/booking
Disallow: /travel/flights/s/
Disallow: /travel/flights/search
Disallow: /travel/hotels/entity
Disallow: /travel/hotels/*/entity
Disallow: /travel/hotels/stories
Disallow: /travel/hotels/*/stories
Disallow: /travel/story
Disallow: /hotelfinder/rpc
Disallow: /hotels/rpc
Disallow: /evaluation/
Disallow: /forms/perks/
Disallow: /shopping/suppliers/search
Disallow: /edu/cs4hs/
Disallow: /trustedstores/s/
Disallow: /trustedstores/tm2
Disallow: /trustedstores/verify
Disallow: /shopping?
Disallow: /shopping/product/
Disallow: /shopping/seller
Disallow: /shopping/ratings/account/metrics
Disallow: /shopping/ratings/merchant/immersivedetails
Disallow: /shopping/reviewer
Disallow: /shopping/search
Disallow: /shopping/deals
Disallow: /storefront
Disallow: /storepicker
Disallow: /about/careers/applications/candidate-prep
Disallow: /about/careers/applications/connect-with-a-googler
Disallow: /about/careers/applications/jobs/results?page=
Disallow: /about/careers/applications/jobs/results/?page=
Disallow: /about/careers/applications/jobs/results?*&page=
Disallow: /about/careers/applications/jobs/results/?*&page=
Disallow: /landing/signout.html
Disallow: /gallery/
Disallow: /landing/now/ontap/
Allow: /maps/reserve
Allow: /maps/reserve/partners
Disallow: /maps/reserve/api/
Disallow: /maps/reserve/search
Disallow: /maps/reserve/bookings
Disallow: /maps/reserve/settings
Disallow: /maps/reserve/manage
Disallow: /maps/reserve/payment
Disallow: /maps/reserve/receipt
Disallow: /maps/reserve/sellersignup
Disallow: /maps/reserve/payments
Disallow: /maps/reserve/feedback
Disallow: /maps/reserve/terms
Disallow: /maps/reserve/m/
Disallow: /maps/reserve/b/
Disallow: /maps/reserve/partner-dashboard
Disallow: /local/cars
Disallow: /local/cars/
Disallow: /local/dealership/
Disallow: /local/dining/
Disallow: /local/place/products/
Disallow: /local/place/reviews/
Disallow: /local/place/rap/
Disallow: /local/tab/
Disallow: /localservices/
Disallow: /nonprofits/account/
Disallow: /uviewer
Disallow: /landing/cmsnext-root/

# AdsBot
User-agent: AdsBot-Google
Disallow: /maps/api/js/
Allow: /maps/api/js
Disallow: /maps/api/place/js/
Disallow: /maps/api/staticmap
Disallow: /maps/api/streetview

# New user agent groups must also have a user agent reference in the global (*)
# group. See "Order of precedence" section in
# https://goo.gle/rep#order-of-precedence-for-user-agents
User-agent: Yandex
Disallow: /about/careers/applications/jobs/results
Disallow: /about/careers/applications-a/jobs/results

# Crawlers of certain social media sites are allowed to access page markup when
# google.com/imgres* links are shared. To learn more, please contact
# images-robots-allowlist@google.com.
User-agent: facebookexternalhit
User-agent: Twitterbot
Allow: /imgres
Allow: /search
Disallow: /groups
Disallow: /hosted/images/
Disallow: /m/

Sitemap: https://www.google.com/sitemap.xml
```

**解讀**：

- ✅ **允許爬取 `/maps/place/`**（餐廳詳情頁）- 規則中明確 `Allow: /maps/place/`
- ✅ **允許爬取 `/maps/search/`**（搜索頁面）- 規則中明確 `Allow: /maps/search/`
- ✅ 允許爬取 `/maps/?q=`（帶查詢參數的地圖搜索）
- ❌ 禁止爬取 `/maps/api/js/`（API 端點）
- ⚠️ 未明確設置 `Crawl-delay`，但建議使用 10-20 秒（保守策略）

**重要發現**：

- Google Maps 的 robots.txt 實際上**允許**爬取 `/maps/place/` 和 `/maps/search/`
- 這與之前的理解不同，但仍建議使用官方 API

**建議**：

- ⚠️ Google Maps 對爬蟲限制較嚴格
- 考慮使用 Google Places API（官方 API，需要 API Key）
- 如果必須爬取，使用更長的延遲（15-20 秒）

#### 服務條款（ToS）

**關鍵條款**：

- 禁止未授權的自動化訪問
- 建議使用官方 API
- 嚴格限制爬蟲行為

**合規措施**：

- ⚠️ **強烈建議使用 Google Places API 而非爬蟲**
- 如果必須爬取，需要：
  - 更長的請求間隔（20 秒以上）
  - 標註為學習用途
  - 限制爬取頻率

---

### 3. Yelp

**網站**：https://www.yelp.com  
**Robots.txt**：https://www.yelp.com/robots.txt  
**最後檢查日期**：2025-12-09 21:59

#### Robots.txt 規則

```
# By accessing Yelp's website (© 2025) you agree to Yelp's Terms of Service, available at
# https://www.yelp.com/static?country=US&p=tos
#
# If you would like to inquire about crawling Yelp, please contact us at
# https://www.yelp.com/contact
#
# As always, Asimov's Three Laws are in effect:
# 1. A robot may not injure a human being or, through inaction, allow a human
#    being to come to harm.
# 2. A robot must obey orders given it by human beings except where such
#    orders would conflict with the First Law.
# 3. A robot must protect its own existence as long as such protection does
#    not conflict with the First or Second Law.

User-Agent: LinkedInBot
User-Agent: Twitterbot
User-Agent: facebookexternalhit
Allow: /article/

User-Agent: Googlebot
User-Agent: Googlebot-Image
User-Agent: Googlebot-Mobile
User-Agent: Googlebot-Video
Allow: /biz_photos/*?select_video=
Allow: /biz_photos/video_url

User-Agent: AdsBot-Google
User-Agent: BingPreview
User-Agent: Google-InspectionTool
User-Agent: Googlebot
User-Agent: Googlebot-Image
User-Agent: Googlebot-Mobile
User-Agent: Googlebot-Video
User-Agent: LinkedInBot
User-Agent: Mediapartners-Google
User-Agent: STC-bot
User-Agent: Twitterbot
User-Agent: Yahoo! Slurp
User-Agent: bingbot
User-Agent: facebookexternalhit
Disallow: *US_CENSUS_NAME*
Disallow: *US_FEMALE_NAME*
Disallow: *US_MALE_NAME*
Disallow: /1014943
Disallow: /3584794
Disallow: /5787254
Disallow: /ad_acknowledgment
Disallow: /ad_spice
Disallow: /ad_syndication_user_tracking
Disallow: /ad_visibility
Disallow: /adredir?
Disallow: /adtrack
Disallow: /advertise?
Disallow: /biz/*?*&translate=1*
Disallow: /biz/*?*&translate=True*
Disallow: /biz/*?translate=1*
Disallow: /biz/*?translate=True*
Disallow: /biz/*destination=*
Disallow: /biz/*entry_point=*
Disallow: /biz/impression/*
Disallow: /biz/outlook-autumn-market-fundamental-catwalk-flimsy-roost-legibility-individualism-grocer-predestination-0
Disallow: /biz/outlook-autumn-market-fundamental-catwalk-flimsy-roost-legibility-individualism-grocer-predestination-1
Disallow: /biz/outlook-autumn-market-fundamental-catwalk-flimsy-roost-legibility-individualism-grocer-predestination-2
Disallow: /biz/outlook-autumn-market-fundamental-catwalk-flimsy-roost-legibility-individualism-grocer-predestination-3
Disallow: /biz/outlook-autumn-market-fundamental-catwalk-flimsy-roost-legibility-individualism-grocer-predestination-4
Disallow: /biz/outlook-autumn-market-fundamental-catwalk-flimsy-roost-legibility-individualism-grocer-predestination-5
Disallow: /biz/outlook-autumn-market-fundamental-catwalk-flimsy-roost-legibility-individualism-grocer-predestination-6
Disallow: /biz/outlook-autumn-market-fundamental-catwalk-flimsy-roost-legibility-individualism-grocer-predestination-7
Disallow: /biz/outlook-autumn-market-fundamental-catwalk-flimsy-roost-legibility-individualism-grocer-predestination-8
Disallow: /biz/outlook-autumn-market-fundamental-catwalk-flimsy-roost-legibility-individualism-grocer-predestination-9
Disallow: /biz_attribute
Disallow: /biz_link
Disallow: /biz_photos
Disallow: /biz_photos/*/log
Disallow: /biz_photos/*/log_views
Disallow: /biz_photos/feedback/
Disallow: /biz_redir
Disallow: /biz_share
Disallow: /biz_update
Disallow: /bn/
Disallow: /bookmark?
Disallow: /browse/reviews/recent
Disallow: /client_errors
Disallow: /collections/following
Disallow: /collections/user
Disallow: /cookie_sync
Disallow: /csp_block
Disallow: /csp_report_only
Disallow: /elite?
Disallow: /email_actions
Disallow: /events
Disallow: /events/export/
Disallow: /facebook_connect
Disallow: /flag_content?
Disallow: /gamtarget
Disallow: /location_suggest
Disallow: /mail?
Disallow: /menu/*/feedback_form
Disallow: /message_the_business
Disallow: /mss/review_feedback/
Disallow: /mtb_composer
Disallow: /not_recommended_reviews
Disallow: /opportunity
Disallow: /photo/
Disallow: /possible_biz_owner
Disallow: /proredir?
Disallow: /px.gif
Disallow: /redir?
Disallow: /reservations/*/notifyme
Disallow: /review_feed_auto_fetch
Disallow: /search_suggest
Disallow: /send_to_friend
Disallow: /sit_rep
Disallow: /spice
Disallow: /start_order
Disallow: /syndicate
Disallow: /syndication_cookie_sync
Disallow: /talk/new_topic
Disallow: /thanx?
Disallow: /transaction_platform/start_order
Disallow: /user_details
Disallow: /user_details_answers_given
Disallow: /user_details_bookmarks
Disallow: /user_details_friends
Disallow: /user_details_reviews_self
Disallow: /user_details_thanx
Disallow: /user_photos
Disallow: /weekly/signup
Disallow: /writeareview/
Disallow: /yuv

User-Agent: Yahoo! Slurp
User-Agent: bingbot
Disallow: /search*start=

User-Agent: GPTBot
Disallow: /

User-Agent: Google-Extended
Disallow: /

User-Agent: *
Disallow: /
```

**解讀**：

- ❌ **禁止所有爬蟲訪問** - `User-Agent: *` 規則中 `Disallow: /`
- ❌ 禁止爬取 `/biz/`（商家詳情頁）
- ❌ 禁止爬取搜索頁面
- ❌ 禁止爬取 `/biz_photos`, `/biz_redir` 等相關路徑
- ⚠️ 未明確設置 `Crawl-delay`，但規則明確禁止爬蟲

**重要發現**：

- Yelp 的 robots.txt **明確禁止所有爬蟲**（`User-Agent: *` + `Disallow: /`）
- **強烈建議使用 Yelp Fusion API**，不要使用爬蟲
- 如需爬取，必須先聯繫 Yelp（見 robots.txt 中的聯繫方式）

**建議**：

- 使用 Yelp Fusion API（官方 API，需要 API Key）
- 如果必須爬取，請求間隔設置為 3-5 秒

#### 服務條款（ToS）

**關鍵條款**：

- 禁止未授權的自動化訪問
- 建議使用官方 API
- 禁止商業用途

**合規措施**：

- ⚠️ **建議使用 Yelp Fusion API 而非爬蟲**
- 如果必須爬取，需要：
  - 標註為學習用途
  - 限制爬取頻率
  - 遵守 ToS

---

## ⚖️ 通用合規規則

### 1. User-Agent 設置

**建議格式**：

```
User-Agent: PartyBillCalculator-Bot/1.0 (Educational Purpose; +https://your-website.com/contact)
```

**說明**：

- 標註為學習用途
- 包含聯繫方式（可選）
- 使用真實的應用名稱

### 2. 請求間隔

**建議設置**：

- OpenRice：3-5 秒
- Google Maps：20-30 秒（或使用 API）
- Yelp：3-5 秒（或使用 API）

**實現方式**：

```typescript
// 在每次請求之間添加延遲
await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 秒
```

### 3. 錯誤處理

**建議**：

- 遇到 429（Too Many Requests）時，增加延遲
- 遇到 403（Forbidden）時，停止爬取並檢查規則
- 實現指數退避重試機制

### 4. 資料使用

**限制**：

- ✅ 僅用於學習和研究目的
- ✅ 不進行商業用途
- ✅ 不重新分發原始資料
- ✅ 尊重版權和隱私

---

## 📝 檢查清單

在開始爬蟲前，確認：

- [ ] 已檢查目標網站的 `robots.txt`
- [ ] 已閱讀並理解服務條款（ToS）
- [ ] 已設置合適的 User-Agent
- [ ] 已實現速率限制
- [ ] 已實現錯誤處理和重試機制
- [ ] 已標註為學習用途
- [ ] 已考慮使用官方 API（如果可用）
- [ ] 已記錄爬取日誌
- [ ] 已準備好處理反爬蟲機制

---

## 🔄 定期更新

**建議**：

- 每 3 個月檢查一次 `robots.txt` 規則
- 每 6 個月檢查一次服務條款
- 記錄規則變更日期

**更新記錄**：

- 2025-01-XX：初始記錄

---

## 📞 聯繫方式

如有疑問或需要澄清，建議：

1. 查看目標網站的官方文檔
2. 聯繫網站管理員（如需要）
3. 考慮使用官方 API（如果可用）

---

## ⚠️ 免責聲明

本文檔僅供參考，不構成法律建議。在進行任何爬蟲活動前，請：

1. 自行檢查並遵守目標網站的規則
2. 諮詢法律顧問（如需要）
3. 承擔使用風險

**使用本爬蟲系統即表示您同意遵守所有相關法律和網站規則。**
