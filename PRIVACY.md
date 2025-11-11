Alithos Terminal — Privacy Policy
Last updated: 2025-11-10

This Privacy Policy explains how Alithos Terminal ("Alithos Terminal", "we", "us", or "our") collects, uses, discloses, and safeguards your information when you use our products and services, including our websites, web applications, desktop applications, APIs, integrations, and related services (collectively, the "Services").

By using the Services, you agree to the collection and use of information in accordance with this Policy. If you do not agree, please do not use the Services.

Contact and Controller
- Legal entity: TBD, registered in TBD
- Address: TBD
- Data protection contact: [privacy@yalithos.xyz]
- Global representative: TBD

Scope

This Policy covers personal information processed by Alithos Terminal in connection with:
1) Account registration and authentication
2) Server-side saves (e.g., layouts/workspaces, preferences, connections, and other user content configured to sync)
3) Product usage and diagnostics/telemetry (if enabled)
4) Support, sales, and marketing communications
5) Integrations, third-party services, and subprocessors used to provide the Services

Information We Collect
We collect the following categories of information depending on how you use the Services:

1) Account and Profile Information
- Identifiers: name, username/handle, email address, password hashes (never plain text), authentication tokens, organization/workspace membership
- Optional profile details: avatar, role/title, timezone, locale
- Billing: subscription tier, invoices, payment status, last 4 of card, billing contact (processed by our payment processor; we do not store full card numbers)

2) Authentication and Single Sign-On
- OAuth/OpenID Connect identifiers (subject, issuer), email, name, and workspace/organization mapping
- Multi-factor authentication (MFA) metadata (e.g., TOTP seed fingerprint, recovery method footprints—not secrets in plaintext)

3) Server-Side Saves and User Content
- Layouts and Workspaces: panels, splits, tabs, window positions, sizes, and UI state saved to enable syncing across devices
- Preferences and Settings: themes, keybindings, language, accessibility options, default directories, environment preferences (not environment secrets)
- Connections/Endpoints Metadata: nicknames, hostnames, ports, labels, and non-secret configuration fields
- Command/Project Metadata (if enabled): recent projects, bookmarks, favorites, command snippets metadata and titles (not command output unless explicitly saved by you)
- Content You Upload or Create: files, notes, templates, and artifacts you explicitly store or sync with the Service
Important: We do not ingest plaintext secrets from your shell environment, private keys, or tokens unless you explicitly paste or upload them to the Service. Do not store secrets in layout names, notes, or titles.

4) Application and Usage Data
- Device and app data: app version, OS/version, device type, crash reports
- Interaction data: clicks, navigation paths, feature usage, settings toggles
- Performance and diagnostics: latency, error traces, minimal IP-derived region (where permitted)
- Cookies/local storage: session tokens, CSRF tokens, preferences; see "Cookies and Similar Technologies"
Note: You may opt out of non-essential analytics where legally required or via in-product settings if available.

5) Support, Sales, and Communications
- Messages you send us (email, chat), attachments, metadata
- Contact preferences, feedback, and survey responses

6) Payment and Commercial Information
- Subscription status, plan, renewal data
- Payment tokenization and transaction records handled by our payment processor (e.g., Stripe); we do not store full card details

7) Log Data and Security Events
- Authentication logs, session creation/termination, admin actions
- IP address, user-agent, timestamps, event and error logs
- Security alerts, rate limiting, and abuse prevention signals

8) Third-Party Services and Integrations
- If you connect third-party services (e.g., Git providers, cloud storage, email, SSO), we process identifiers, tokens, and metadata necessary to enable those integrations. The scope is shown at connect time.

How We Use Information
We process your data for the following purposes:
- Provide, operate, maintain, and improve the Services
- Sync your server-side saves (e.g., layouts, preferences) across devices
- Authenticate you and secure access (including fraud/abuse prevention)
- Personalize features (e.g., theme, keybindings, defaults)
- Provide customer support and respond to inquiries
- Process payments and manage subscriptions
- Analyze usage to improve reliability and performance (where permitted)
- Send transactional emails (e.g., verification, password resets, receipts, service notices)
- Send product updates and marketing communications (with your consent where required)
- Comply with legal obligations, enforce agreements, and resolve disputes

Legal Bases for Processing (EEA/UK/LGPD where applicable)
- Contract: to provide the Services you requested
- Legitimate interests: to secure, improve, and support the Services
- Consent: for non-essential analytics/marketing where required
- Legal obligation: tax, accounting, regulatory requirements

Server-Side Saves (Layouts, Preferences, and Related Data)
- Layouts/workspaces, UI configurations, and preferences you choose to sync are stored server-side to enable cross-device continuity and recovery
- We store only the metadata necessary to reconstruct UI state (e.g., split/topology, panel types, sizes, active tabs)
- We do not store shell command outputs or environment variables unless you explicitly save them in user content fields
- You can delete saved layouts/preferences; deletion will remove them from our servers within a reasonable period per the Retention section

Emails We Send
- Transactional: account verification, password reset, security alerts, billing receipts, critical service notices
- Operational/product: release notes, feature announcements, and onboarding guides (opt-out available where required)
- Marketing: newsletters and promotions (sent only with consent where required; opt-out anytime via unsubscribe)
- Service Providers: We use reputable email processors (e.g., SES, SendGrid, Postmark, Resend). These providers process recipient email, content, and delivery/engagement metadata on our behalf.

Payment Processing
- We use a third-party payment processor (e.g., Stripe) to handle payments. They collect and process payment information. We receive limited billing metadata (e.g., last 4 digits, card brand, expiration, billing status). We do not store full card numbers or CVVs.

Cookies and Similar Technologies
- Essential cookies: required for login, security, and core functionality (e.g., session and CSRF tokens)
- Preferences: remember UI settings and non-essential preferences
- Analytics (where enabled): help us understand usage and performance
- Marketing (where applicable): measure campaign effectiveness (consent where required)
You can control cookies through browser settings. Disabling certain cookies may impact functionality.

Data Sharing and Disclosure
We do not sell your personal information. We share data only as described below:
- Service Providers/Subprocessors: infrastructure, email, analytics, customer support, logging, payments, and security vendors who process data on our behalf under contractual safeguards
- Integrations you enable: when you connect a third-party provider, we share the minimum data required to enable the integration, consistent with scopes you approve
- Legal, Safety, and Compliance: to comply with laws, lawful requests, or to protect rights, safety, or property
- Business Transfers: as part of a merger, acquisition, financing, or sale of assets, subject to continued protections

International Data Transfers
- If we transfer personal data internationally (including to the U.S.), we implement appropriate safeguards such as the EU Standard Contractual Clauses (SCCs) and UK IDTA/Addendum as applicable.

Data Retention
- Account data: retained for the life of the account; deleted or anonymized within [30–90] days after account deletion, subject to legal retention requirements
- Server-side saves (layouts, preferences): retained until you delete them or delete your account
- Logs: security and application logs retained typically for [30–180] days unless needed to investigate incidents or comply with law
- Billing records: retained per tax/accounting obligations (e.g., 7–10 years in some jurisdictions)
- Backups: appear in encrypted backups with rolling deletion per backup schedule; not immediately purgeable but aged out per policy

Your Rights and Choices
Depending on your location, you may have rights to:
- Access, rectify, or delete your personal data
- Port your data
- Object to or restrict certain processing
- Withdraw consent where processing is based on consent
You can exercise these rights via in-product controls where available or by contacting us at [privacy@yourdomain.com]. We will verify your identity before fulfilling requests where required.

California Privacy (CCPA/CPRA)
- We do not sell or share (as defined by CPRA) personal information for cross-context behavioral advertising
- Categories collected: identifiers (e.g., email), commercial information (subscriptions), internet activity (usage logs), inferences (limited product personalization)
- Purposes: provide and improve Services, security, billing, support
- Sensitive personal information: we do not use or disclose sensitive personal information for purposes other than those permitted by CPRA §1798.121
- Rights: know, delete, correct, opt-out of sale/share (not applicable), limit use of sensitive PI (not applicable); submit requests at [privacy@yourdomain.com]

Children’s Privacy
Our Services are not directed to children under 16 (or as defined by local law). We do not knowingly collect personal information from children. If you believe a child has provided us data, contact us to remove it.

Security
- We employ administrative, technical, and physical measures designed to protect personal information, including encryption in transit, encryption at rest for sensitive datasets, access controls, and monitoring
- No method of transmission or storage is 100% secure; you are responsible for maintaining the secrecy of your credentials and for securing your devices

Data Minimization and Confidential Computing
- We minimize the personal information stored server-side and avoid collecting plaintext secrets
- If you opt into experimental AI features or cloud-based processing, relevant inputs and outputs may be processed by subprocessors solely to provide those features; we disclose these providers in our Subprocessors list

Subprocessors
We engage third parties to help us provide the Services. Our current subprocessors and their roles are listed at:
- [Link to Subprocessors page or appendix in this file]
For email delivery, payments, hosting, analytics, error logging, and support, we use established providers with contractual data protection commitments.

Your Responsibilities
- Do not store secrets (passwords, tokens, private keys) in layout names, titles, notes, or other fields not designed for secrets
- Use strong, unique passwords and enable MFA where available
- Review permissions requested by integrations before enabling them

Do Not Track and Global Privacy Control
- Our Services respond to consent signals where required by local law. Browser-based "Do Not Track" signals are not uniformly honored across jurisdictions, but we will honor Global Privacy Control signals for applicable processing where required.

Changes to This Policy
We may update this Policy from time to time. We will post the updated Policy with a new "Last updated" date and, where required, provide additional notice. Continued use of the Services after changes constitutes acceptance.

How to Contact Us
For questions or requests, please contact:
- Email: [privacy@alithos.xyz]
- Mailing: TBD, TBD

Definitions
- "Personal information" or "personal data" means information that identifies or can reasonably be linked to an identified or identifiable natural person
- "Process" means any operation performed on personal information, such as collection, storage, use, disclosure, and deletion
- "Subprocessor" means a third party engaged by us to process personal information on our behalf

Appendix A — Data Categories and Purposes Mapping
The following table maps key data categories to purposes and typical retention. Actual retention may vary as described in "Data Retention".

1) Account and Profile
- Purposes: authentication, access control, support, billing
- Retention: life of account; [30–90] days post-deletion (except billing)

2) Server-Side Saves (Layouts/Preferences)
- Purposes: sync across devices, restore state, user convenience
- Retention: until user deletes or account deletion

3) Usage and Diagnostics (Telemetry)
- Purposes: reliability, performance, product improvement
- Retention: typically [30–180] days; aggregated/anonymized thereafter

4) Logs and Security Events
- Purposes: security, auditing, incident response
- Retention: typically [30–180] days; longer if required for investigations

5) Support Communications
- Purposes: customer support and service quality
- Retention: for the life of the support thread plus reasonable period

6) Billing Records
- Purposes: compliance with tax and accounting requirements
- Retention: per local law (often 7–10 years)

Appendix B — Regional Disclosures
- EEA/UK: You may lodge a complaint with your local supervisory authority. Our lead supervisory authority (if designated) will be identified here.
- Brazil: We comply with LGPD requirements and process data under legal bases analogous to GDPR.
- Canada: We comply with PIPEDA and provincial laws as applicable.
- Australia: We comply with the APPs under the Privacy Act 1988 (Cth).

Note on Self-Hosted or Enterprise Deployments (if applicable)
Where you run Alithos Terminal in a self-hosted environment, you (the customer) act as the controller of personal data processed within your environment. Our access to that data is limited to support and as otherwise agreed in a separate agreement (e.g., DPA). This Policy applies to our cloud-hosted Services unless otherwise specified.

Non-Legal Notice
This document is provided for informational purposes and does not constitute legal advice. Please consult your legal counsel to tailor this Policy to your specific processing activities, jurisdictions, and regulatory requirements.


