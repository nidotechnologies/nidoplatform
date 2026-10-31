from copy import deepcopy
from datetime import date
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree as ET

SOURCE = Path("attached_assets/Nido_Tech_Process_Flow_1787151469848.docx")
OUTPUT = Path("generated/Nido_Tech_Current_Platform_Process_Flow.docx")

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}
ET.register_namespace("w", W)
ET.register_namespace("r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")


def qn(name):
    prefix, local = name.split(":")
    return f"{{{W if prefix == 'w' else 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}}}{local}"


def run(text, bold=False, italic=False, color=None, size=None):
    r = ET.Element(qn("w:r"))
    if bold or italic or color or size:
        rpr = ET.SubElement(r, qn("w:rPr"))
        if bold:
            ET.SubElement(rpr, qn("w:b"))
            ET.SubElement(rpr, qn("w:bCs"))
        if italic:
            ET.SubElement(rpr, qn("w:i"))
            ET.SubElement(rpr, qn("w:iCs"))
        if color:
            ET.SubElement(rpr, qn("w:color"), {qn("w:val"): color})
        if size:
            ET.SubElement(rpr, qn("w:sz"), {qn("w:val"): str(size)})
            ET.SubElement(rpr, qn("w:szCs"), {qn("w:val"): str(size)})
    t = ET.SubElement(r, qn("w:t"), {"{http://www.w3.org/XML/1998/namespace}space": "preserve"})
    t.text = text
    return r


def paragraph(text="", style=None, align=None, before=None, after=None, bold=False,
              italic=False, color=None, size=None, page_break=False):
    p = ET.Element(qn("w:p"))
    if style or align or before is not None or after is not None:
        ppr = ET.SubElement(p, qn("w:pPr"))
        if style:
            ET.SubElement(ppr, qn("w:pStyle"), {qn("w:val"): style})
        if align:
            ET.SubElement(ppr, qn("w:jc"), {qn("w:val"): align})
        if before is not None or after is not None:
            attrs = {}
            if before is not None:
                attrs[qn("w:before")] = str(before)
            if after is not None:
                attrs[qn("w:after")] = str(after)
            ET.SubElement(ppr, qn("w:spacing"), attrs)
    if page_break:
        r = ET.SubElement(p, qn("w:r"))
        ET.SubElement(r, qn("w:br"), {qn("w:type"): "page"})
    if text:
        p.append(run(text, bold=bold, italic=italic, color=color, size=size))
    return p


def rich_paragraph(parts, style=None, before=None, after=None):
    p = ET.Element(qn("w:p"))
    if style or before is not None or after is not None:
        ppr = ET.SubElement(p, qn("w:pPr"))
        if style:
            ET.SubElement(ppr, qn("w:pStyle"), {qn("w:val"): style})
        if before is not None or after is not None:
            attrs = {}
            if before is not None:
                attrs[qn("w:before")] = str(before)
            if after is not None:
                attrs[qn("w:after")] = str(after)
            ET.SubElement(ppr, qn("w:spacing"), attrs)
    for text, opts in parts:
        p.append(run(text, **opts))
    return p


def table(rows, widths=None):
    tbl = ET.Element(qn("w:tbl"))
    tblpr = ET.SubElement(tbl, qn("w:tblPr"))
    ET.SubElement(tblpr, qn("w:tblBorders"))
    if widths:
        grid = ET.SubElement(tbl, qn("w:tblGrid"))
        for width in widths:
            ET.SubElement(grid, qn("w:gridCol"), {qn("w:w"): str(width)})
    for row_index, row in enumerate(rows):
        tr = ET.SubElement(tbl, qn("w:tr"))
        for value in row:
            tc = ET.SubElement(tr, qn("w:tc"))
            tcp = ET.SubElement(tc, qn("w:tcPr"))
            ET.SubElement(tcp, qn("w:tcW"), {qn("w:w"): "3000", qn("w:type"): "dxa"})
            p = paragraph(str(value), bold=row_index == 0, color="FFFFFF" if row_index == 0 else None)
            if row_index == 0:
                rpr = p.find(qn("w:r")).find(qn("w:rPr"))
                shd = ET.SubElement(tcp, qn("w:shd"), {qn("w:fill"): "1F4E78"})
            tc.append(p)
    return tbl


def bullet(text):
    return paragraph("• " + text, style="ListParagraph", after=80)


def flow(text):
    return paragraph(text, align="center", before=100, after=160, bold=True, color="1F4E78", size=22)


def heading(text, level=1):
    return paragraph(text, style=f"Heading{level}", before=320 if level == 1 else 220, after=160)


def build_body():
    body = ET.Element(qn("w:body"))
    body.append(paragraph("NIDO-TECHNOLOGIES", align="center", before=2000, after=0, bold=True, color="1F4E78", size=30))
    body.append(paragraph("Current Platform Process Flow Documentation", align="center", before=200, after=0, bold=True, size=44))
    body.append(paragraph("Procurement, Vendor, Client & Financial Transaction Platform", align="center", before=200, after=3000, italic=True, color="666666", size=24))
    body.append(paragraph("Prepared for internal process review and QA validation", align="center", color="666666", size=20))
    body.append(paragraph(page_break=True))

    body.append(heading("Table of Contents", 1))
    for item in [
        "1. Platform Overview", "2. Authentication, Onboarding & Access",
        "3. User Management & Permissions", "4. Catalogue, Vendor Stock & Availability",
        "5. Shopping, Reservation & Order Placement", "6. Order Lifecycle & Fulfilment",
        "7. Vendor Management & Allocation", "8. Client Management & Client Portal",
        "9. Sales Transaction Flow (Quote to Cash)", "10. Purchase Transaction Flow (Procure to Pay)",
        "11. Approval Workflows, SLAs & Notifications", "12. Services, Support & Audit",
        "13. Configuration & Administration", "14. End-to-End Summary",
    ]:
        body.append(paragraph(item, style="ListParagraph", after=60))
    body.append(paragraph(page_break=True))

    body.append(heading("1. Platform Overview"))
    body.append(paragraph("Nido-Technologies is a procurement and business-management platform organized around a central Dashboard and the following functional areas:"))
    for item in [
        "Shopping — browse the catalogue, compare vendor availability, add items to a cart and submit orders.",
        "Orders Management — review requests, order status, sub-orders, fulfilment and vendor allocation.",
        "Vendor Management — onboard vendors, manage vendor products, stock, vendor orders, performance and payments.",
        "Clients Management — manage client organizations, users, contracts, catalogues, services, orders and activity.",
        "Sales Transactions — quotes, sales orders, delivery challans, invoices, receipts, credit notes and recurring invoices.",
        "Purchase Transactions — purchase orders, bills, expenses, payments made and vendor credits.",
        "Configuration & Admin — users, roles, permissions, catalogue, tax, pricing, SLAs, approvals, stock and system logs.",
    ]:
        body.append(bullet(item))
    body.append(paragraph("The platform serves two user experiences: the Admin Portal for internal Nido staff and the scoped Client Portal for client-side administrators and users. Access, approval rights, catalogue visibility and operational actions are controlled by role and organization context."))

    body.append(heading("2. Authentication, Onboarding & Access"))
    body.append(flow("Invitation / Existing Account → Login → Account Validation → Admin Dashboard or Client Portal Dashboard"))
    body.append(paragraph("Process steps:"))
    for item in [
        "An administrator creates or invites an internal user from Nido-Users or invites a client-portal user from the relevant client user-management area.",
        "The invitee opens the onboarding link, completes the available account setup and is assigned the appropriate account type, role and organization scope.",
        "The user signs in through the standard Login page. Internal Nido users are routed to the Admin Portal; client users are routed to the Client Portal.",
        "Account status is checked before access is granted. Inactive, suspended and locked accounts are blocked; failed sign-in attempts are recorded for security review.",
        "Forgot-password and recovery-code paths provide account recovery. Login activity, device information and available location context are recorded for audit purposes.",
    ]:
        body.append(bullet(item))
    body.append(paragraph("Current implementation note: onboarding, authentication state, user and portal-user records are connected to the platform’s active stores and update the UI through shared refresh events."))

    body.append(heading("3. User Management & Permissions"))
    body.append(flow("Create Role → Configure Permissions → Add / Manage User → Assign Department → Activate / Suspend → Audit"))
    for item in [
        "Nido-Users is the canonical internal user and role-management area.",
        "Roles define module-level view, create, edit and delete permissions. The protected System Owner cannot be edited or removed.",
        "Add / Manage Users supports live add, edit, delete, status change, password reset, force-password-change, account unlock and login-history actions.",
        "User records are persisted through the shared live user store and immediately reflected in the list, search and permission context.",
        "Departments support organization and workflow routing. Audit Trail records significant actions and authentication events.",
    ]:
        body.append(bullet(item))

    body.append(heading("4. Catalogue, Vendor Stock & Availability"))
    body.append(flow("Master Catalogue → Vendor Product Mapping → Current Physical Stock → Reserved Stock → Available Stock"))
    body.append(paragraph("The catalogue and vendor-product records provide the stock values used by both Stock Management and Shop:"))
    body.append(table([
        ["Stock value", "Current platform behavior"],
        ["Current / Physical", "Units physically held by the vendor. Manual stock-in and stock-out adjustments change this value."],
        ["Reserved", "Units held for confirmed client or internal orders. Cart and order actions change reservations without consuming physical stock."],
        ["Available", "Computed as Current Physical Stock minus Reserved Stock. This is the quantity shown to buyers and used for quantity limits."],
        ["Incoming", "Expected or inbound quantity shown alongside current, reserved and available stock for planning."],
    ], [2400, 7000]))
    for item in [
        "Vendor Products supports current, reserved, available and incoming stock fields, with migration support for legacy stock records.",
        "The Shop uses the centralized availability calculation across vendors and prevents ordering beyond available quantity.",
        "When a Purchase Order is raised, the PO vendor’s physical stock and reserved stock are consumed together. Cancelling or restoring a PO reverses the appropriate stock movement.",
        "Stock history records the reason, quantity and before/after values for material stock changes.",
    ]:
        body.append(bullet(item))

    body.append(heading("5. Shopping, Reservation & Order Placement"))
    body.append(flow("Shop / Search → Product Details → Vendor Comparison → Add to Cart → Reserve Stock → Cart Review → Checkout → Order Confirmation"))
    for item in [
        "The buyer browses or searches products and views specifications, pricing, vendor options and available stock.",
        "Vendor comparison considers price, delivery and vendor scoring inputs. A vendor can be locked at the Shop stage before the item enters the cart.",
        "Adding an item to the cart reserves the requested quantity. Physical stock is not reduced at cart time.",
        "The cart supports quantity updates and item removal; reservation changes are released or increased accordingly.",
        "Checkout captures the order details and confirmation creates the trackable order record. The buyer can follow it through My Orders / My Requests or the Client Portal.",
    ]:
        body.append(bullet(item))

    body.append(heading("6. Order Lifecycle & Fulfilment"))
    body.append(flow("Draft → Confirmed → Processing → Completed / Cancelled"))
    body.append(table([
        ["Status", "Meaning"],
        ["Draft", "Order is being prepared and has not been confirmed."],
        ["Confirmed", "Order has been accepted for processing."],
        ["Processing", "Vendor assignment, purchase-order work, picking, packing or service delivery is in progress."],
        ["Completed", "Goods or services have been delivered and the order is closed."],
        ["Cancelled", "Order was cancelled before completion; applicable reservations are released."],
    ], [2400, 7000]))
    body.append(paragraph("Order Details exposes the order items and sub-orders. Admin users also see the Vendor Selected Summary, vendor score and stock breakdown, allocation actions and Draft Purchase Orders generated for the selected vendors."))

    body.append(heading("7. Vendor Management & Allocation"))
    body.append(flow("Vendor Onboarding → Vendor Directory → Vendor Products / Categories → Weighted Scoring → Auto-Allocation → Purchase Orders → Performance / Payments"))
    for item in [
        "Vendor onboarding captures organization, contact, category, bank and compliance information as applicable.",
        "Vendor Detail provides the vendor’s overview, products, orders, services, performance, contracts, configuration, payments and activity.",
        "Products are mapped to vendors with pricing, lead time, MOQ, stock and service information.",
        "Vendor selection uses weighted scoring and supports manual selection or automatic allocation across eligible vendors.",
        "Allocation creates vendor-specific sub-orders and draft POs. Each PO can proceed through approval, confirmation, shipping, delivery and closure.",
        "Vendor status controls whether a vendor can receive new allocations: Pending, Active, On Hold or Inactive.",
    ]:
        body.append(bullet(item))

    body.append(heading("8. Client Management & Client Portal"))
    body.append(flow("Add Client → Organization Profile → Client Detail → Users / Roles → Contracts / Catalog → Client Portal Access"))
    for item in [
        "Clients are created with organization profile, primary contact, address, tax and account information.",
        "Client Detail centralizes Overview, Roles, Users, Orders, Services, Contracts, Catalog, Activity, Configuration and Documents.",
        "Client users are provisioned with client scope and portal permissions. They can shop from the assigned catalogue, submit requests, view invoices, manage contracts and follow approvals.",
        "Client activity records notes, comments, updates, tasks, mentions and other interactions for the organization.",
    ]:
        body.append(bullet(item))

    body.append(heading("9. Sales Transaction Flow (Quote to Cash)"))
    body.append(flow("Quote → Sales Order → Delivery Challan → Invoice → Payment Receipt → Credit Note / e-Way Bill (as needed)"))
    for item in [
        "Quotes are created with line items, pricing, taxes, discounts and terms, then sent to the client for review.",
        "An accepted quote can be converted to a Sales Order. Direct sales orders are also supported.",
        "Delivery Challans document dispatch against a sales order and can be referenced by the invoice.",
        "Invoices are generated against sales orders or delivery challans and expose overview, line items, payments and activity.",
        "Payment Receipts record amounts received and their allocation to invoices. Credit Notes handle returns, disputes and corrections; e-Way Bills support applicable compliance needs.",
        "Recurring Invoices generate scheduled invoice instances that follow the normal invoice lifecycle.",
    ]:
        body.append(bullet(item))

    body.append(heading("10. Purchase Transaction Flow (Procure to Pay)"))
    body.append(flow("Draft Purchase Order → Approval (if configured) → Vendor Confirmation → Shipped → Delivered → Bill Match → Payment Made → Closed"))
    for item in [
        "A Purchase Order is generated for the vendor-selected sub-order with quantities, agreed pricing, delivery details and payment terms.",
        "Configured approval workflows route the PO to the required internal approver before vendor processing.",
        "PO processing tracks vendor confirmation, dispatch, delivery and closure. PO creation consumes the physical and reserved stock committed to that vendor.",
        "Bills are recorded and matched to the corresponding PO for reconciliation. Expenses support ad-hoc or recurring spend outside a PO.",
        "Payments Made records settlement against vendor bills. Vendor Credits record credits received for returns, corrections or commercial adjustments.",
    ]:
        body.append(bullet(item))

    body.append(heading("11. Approval Workflows, SLAs & Notifications"))
    body.append(flow("Configure Rules → Evaluate Transaction → Pending Approval → Approve / Reject / Delegate → Continue or Return"))
    for item in [
        "Admins define multi-level approval chains with conditions, thresholds, approver roles or specific users, minimum approvers and approval mode.",
        "Matching quotes, purchase orders, expenses and other configured transactions create approval requests before the transaction proceeds.",
        "Approvers can review, approve, reject, delegate or reassign within their authorized scope. The request history records each decision.",
        "SLA rules define target, warning and breach timings for vendor, client, procurement, service and approval stages.",
        "Notifications and email configuration govern event alerts, templates and provider behavior.",
    ]:
        body.append(bullet(item))

    body.append(heading("12. Services, Support & Audit"))
    body.append(heading("12.1 Service Requests / AMC", 2))
    body.append(flow("Raise Service Request → New AMC Request (if applicable) → Assignment → Fulfilment → Closure"))
    body.append(paragraph("Service requests can be raised by Admin users or Client Portal users, assigned to the responsible team and tracked through My Requests / My Services with SLA visibility."))
    body.append(heading("12.2 Support Tickets", 2))
    body.append(flow("Contact Us / Support → Ticket Assignment → Updates & Tracking → Resolution / Closure"))
    body.append(paragraph("Support includes Contact Us, Help Center and FAQs. Tickets expose a tracking path for the requester and retain updates through resolution."))
    body.append(heading("12.3 Audit & System Logs", 2))
    body.append(paragraph("Audit Trail and System Logs provide platform-wide visibility into user actions, authentication events, stock movements, workflow actions, transaction updates and configuration changes."))

    body.append(heading("13. Configuration & Administration"))
    body.append(paragraph("Configuration is the control center for the platform. The usual setup sequence is:"))
    for item in [
        "General Settings — organization profile, branding, localization, currency, document prefixes, notifications and security defaults.",
        "Nido-Users — internal users, roles, permissions, departments and live account administration.",
        "Master Catalogue and Catalog Updates — products, services, SKU, category, brand, pricing, MOQ, lead time, warranty and media.",
        "Vendor, Client and Tax Settings — vendor/client/service tax, tax categories, HSN/SAC codes and mappings.",
        "Price Engine — pricing, discounts and vendor comparison rules used across transactions.",
        "Stock Management — physical, reserved, available and incoming inventory as the stock source of truth.",
        "Approval Workflows — conditional, multi-level approval chains and approval history.",
        "SLA Management — stage targets, warnings, breaches, escalation rules and business calendar.",
        "Order Statuses, Auto Assignment and Notifications — lifecycle customization, analyst routing and alerts.",
        "Integrations and System Logs — connected services, API configuration and diagnostic events.",
    ]:
        body.append(bullet(item))

    body.append(heading("14. End-to-End Summary"))
    body.append(flow("Client Onboarded → Catalogue & Stock Configured → Product Ordered → Stock Reserved → Vendor Scored / Allocated → PO Raised → Stock Consumed → Fulfilment → Invoice → Payment → Order Completed"))
    body.append(paragraph("A typical full cycle through the platform begins with client and catalogue setup, continues through shopping and reservation, uses weighted vendor selection and purchase-order fulfilment, and closes through sales invoicing and payment."))
    body.append(paragraph("At every stage, the platform is governed by roles and permissions, approval workflows, stock rules, pricing and tax configuration, SLA targets, notifications and audit logging."))
    body.append(paragraph("Document status: Current platform process flow for internal review and QA validation."))

    # Reuse the source document's section properties, headers and footers.
    source_root = ET.fromstring(unzip_member(SOURCE, "word/document.xml"))
    sectpr = source_root.find(".//" + qn("w:sectPr"))
    if sectpr is not None:
        body.append(deepcopy(sectpr))
    return ET.tostring(body, encoding="utf-8", xml_declaration=True)


def unzip_member(path, member):
    with ZipFile(path) as zf:
        return zf.read(member)


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    new_document = build_body()
    with ZipFile(SOURCE) as source, ZipFile(OUTPUT, "w", ZIP_DEFLATED) as target:
        for info in source.infolist():
            data = new_document if info.filename == "word/document.xml" else source.read(info.filename)
            target.writestr(info, data)
    print(OUTPUT)


if __name__ == "__main__":
    main()