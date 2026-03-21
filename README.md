<img src="public/logo.png" width="80" height="80" />

# Remit

**Remit** is an open-source, self-hostable business management tool built for freelancers — own your
data, own your workflow, no subscriptions required.

## Why Remit?

Most invoicing and proposal tools are SaaS — monthly fees, your financial data on someone else's
servers, and features you'll never use. Remit is built for freelancers who want full control: run it
on your own server, own everything, and never depend on a third-party platform. A single command,
everything in Docker, nothing to configure manually.

## Key Features

The core workflow is **Client → Project → Proposal → Invoice**.

- **Client Management**: Complete client profiles with billing address, tax ID, contact details, and
  internal notes. Full invoice and project history centralised per client.
- **Project Management**: Associate projects to clients, track status (Active, Completed, On Hold,
  Cancelled), set budgets, and manage start/end dates.
- **Proposals**: Create and send professional proposals per project with line items (description,
  qty, unit price, discount, tax). Lifecycle: _Draft → Sent → Accepted → Rejected_. Accepted
  proposals convert to invoices in one click.
- **Invoices**: Generate manually or from an accepted proposal. Multiple line items with per-item
  discounts (percentage or fixed) and configurable tax rates. Lifecycle: _Draft → Sent → Paid →
  Overdue_, with automatic overdue detection when the due date passes without payment.
- **PDF Generation**: Export invoices and proposals as professional PDFs using your chosen template
  and business branding.
- **Template Editor**: Block-based visual editor for invoice and proposal templates.
- **Email Sending**: Send invoices and proposals directly to clients with editable templates and
  dynamic variables. Supports your own SMTP server or Resend for managed deliverability.
- **Shareable Links**: Each invoice and proposal gets a unique, secure link — clients can view it in
  a browser with no account required.
- **Dashboard**: Business overview with total revenue, monthly billing chart, active projects,
  pending proposals, and recent activity.
- **Settings**: Full configuration for business details, invoice/proposal defaults, email provider,
  and hosting base URL.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
