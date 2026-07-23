import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        if self._pageNumber == 1:
            # Skip page number on cover page
            return
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#475569"))
        
        # Header
        self.drawString(54, 750, "Billionaire Brother - Agentic MCP REST API Documentation")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, 742, 558, 742)
        
        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 40, page_text)
        self.drawString(54, 40, "CONFIDENTIAL - FOR INTERNAL AI & DEVELOPER USE ONLY")
        self.line(54, 52, 558, 52)
        
        self.restoreState()

def build_pdf(filename="billionaire_brother_mcp_documentation.pdf"):
    # Target page width = 612, height = 792 (letter size)
    # Margins: 0.75 inch = 54 points on all sides
    # Usable width = 612 - 108 = 504 points
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=72,
        bottomMargin=72
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    primary_color = colors.HexColor("#0f172a") # Slate 900
    accent_color = colors.HexColor("#0284c7") # Sky 600
    text_color = colors.HexColor("#334155") # Slate 700
    bg_light = colors.HexColor("#f8fafc") # Slate 50
    border_color = colors.HexColor("#e2e8f0") # Slate 200

    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=28,
        leading=34,
        textColor=primary_color,
        spaceAfter=15
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#475569"),
        spaceAfter=30
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=primary_color,
        spaceBefore=20,
        spaceAfter=10,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=accent_color,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=text_color,
        spaceAfter=10
    )

    body_bold = ParagraphStyle(
        'BodyTextBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0f172a"),
        backColor=bg_light,
        borderColor=border_color,
        borderWidth=0.5,
        borderPadding=6,
        spaceBefore=8,
        spaceAfter=8
    )

    th_style = ParagraphStyle(
        'TableHeaderStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white
    )

    td_style = ParagraphStyle(
        'TableCellStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=text_color
    )

    td_code = ParagraphStyle(
        'TableCellCodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0f172a")
    )

    story = []

    # ================= COVER PAGE =================
    story.append(Spacer(1, 100))
    story.append(Paragraph("Billionaire Brother", title_style))
    story.append(Paragraph("Agentic MCP REST API Specification", subtitle_style))
    
    # Metadata Box
    metadata_data = [
        [Paragraph("<b>Document Version:</b> 1.0.0", body_style)],
        [Paragraph("<b>Status:</b> Deployed & Active", body_style)],
        [Paragraph("<b>Base URL:</b> <font color='#0284c7'>https://thebillionairebrother.com</font>", body_style)],
        [Paragraph("<b>Auth Method:</b> Bearer Token (Authorization Header)", body_style)],
        [Paragraph("<b>Target Audience:</b> AI Agents, Workflows, External Automations", body_style)]
    ]
    t_meta = Table(metadata_data, colWidths=[400])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_light),
        ('PADDING', (0,0), (-1,-1), 12),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_meta)
    
    story.append(Spacer(1, 200))
    story.append(Paragraph("<i>This document outlines the machine-consumable endpoints developed to allow AI agents to securely inspect, update, and manage workspace database tables directly, bypassing standard row-level security (RLS) via a pre-shared API key.</i>", body_style))
    story.append(PageBreak())

    # ================= OVERVIEW =================
    story.append(Paragraph("1. System Architecture Overview", h1_style))
    story.append(Paragraph(
        "The Billionaire Brother Agentic MCP (Machine-Consumable Platform) REST API layer provides a secure, "
        "stateless interface for AI agents and scripts to interact directly with the backend database. "
        "Unlike standard client-facing endpoints which use Row-Level Security (RLS) and OAuth sessions, "
        "the MCP layer bypasses RLS using a service-role admin client. It enforces authentication via a "
        "pre-shared API key and strictly whitelists operations to prevent unauthorized database modifications.",
        body_style
    ))

    story.append(Paragraph("Authentication & Security Details", h2_style))
    story.append(Paragraph(
        "Every request to the MCP endpoints must present the header: <br/>"
        "<b>Authorization: Bearer &lt;MCP_API_KEY&gt;</b><br/>"
        "If the header is missing, incorrect, or the key is not configured on the server, the endpoint returns a "
        "<code>401 Unauthorized</code> or <code>500 Server Error</code>.",
        body_style
    ))
    
    story.append(Paragraph("Response Format", h2_style))
    story.append(Paragraph(
        "All endpoints return a consistent JSON response schema:<br/>"
        "• <b>Success (HTTP 200/201):</b> <code>{ \"success\": true, \"data\": ... }</code><br/>"
        "• <b>Failure (HTTP 4xx/5xx):</b> <code>{ \"success\": false, \"error\": \"Human-readable error description\" }</code>",
        body_style
    ))

    story.append(Paragraph("Routing Conventions", h2_style))
    story.append(Paragraph(
        "The endpoints follow a standard dynamic layout:<br/>"
        "• <code>GET /api/mcp/[resource]</code> — Lists records with support for filtering, sorting, and limits.<br/>"
        "• <code>POST /api/mcp/[resource]</code> — Creates a new record. Whitelists inputs and validates required fields.<br/>"
        "• <code>GET /api/mcp/[resource]/[id]</code> — Retrieves details of a specific record by primary key.<br/>"
        "• <code>PATCH /api/mcp/[resource]/[id]</code> — Updates allowed fields of a specific record by ID.<br/>"
        "• <code>DELETE /api/mcp/[resource]/[id]</code> — Deletes a specific record by ID.",
        body_style
    ))

    story.append(PageBreak())

    # ================= CONFIG & RESOURCES =================
    story.append(Paragraph("2. Exposed Resources Reference Table", h1_style))
    story.append(Paragraph(
        "The following table details the schemas exposed via the MCP API. For each resource, specific whitelisted "
        "fields, required fields, and parent filter rules are configured in the system.",
        body_style
    ))

    # Configuration Dictionary mimicking config.ts
    configs = [
        ("users", "None", "email", "email, display_name, stripe_customer_id, subscription_status, subscription_plan, onboarding_complete"),
        ("business_profiles", "user_id", "user_id", "business_name, business_state, industry, current_revenue_range, strengths, weaknesses, risk_tolerance, hours_per_week, monthly_budget_range, no_go_constraints, target_audience, existing_assets, additional_context, raw_answers"),
        ("founder_profiles", "user_id", "user_id", "team_size, va_count, calendar_blocks_available, timezone"),
        ("decisions", "user_id", "user_id", "business_profile_id, status, chosen_strategy_id, thread_id, chosen_at"),
        ("strategy_options", "decision_id", "decision_id, rank, archetype, thesis", "rank, archetype, thesis, channel_focus, offer_shape, first_7_day_plan, risks, mitigations, kpis, decision_score, confidence, score_breakdown, assumptions, raw_ai_output"),
        ("execution_contracts", "user_id", "user_id, decision_id, strategy_id, locked_kpi, weekly_deliverable, calendar_blocks", "decision_id, strategy_id, locked_kpi, weekly_deliverable, calendar_blocks"),
        ("weekly_cycles", "user_id", "user_id, week_number", "execution_contract_id, week_number, status, kpi_target, kpi_actual, board_meeting_notes, kill_list, keep_list, double_list, thread_id, completed_at"),
        ("deliverables", "weekly_cycle_id", "user_id, weekly_cycle_id, department, title, size", "department, title, size, status, content, red_team_passed, red_team_feedback"),
        ("tasks", "weekly_cycle_id", "user_id, weekly_cycle_id, title", "deliverable_id, title, description, assignee, status, due_date, sort_order"),
        ("assets", "user_id", "user_id, title, asset_type", "deliverable_id, asset_type, title, content, storage_path"),
        ("assumptions", "strategy_option_id, weekly_cycle_id", "assumption_text", "strategy_option_id, weekly_cycle_id, assumption_text, category, risk_level"),
        ("generation_jobs", "user_id", "user_id, job_type", "job_type, reference_id, status, attempts, max_attempts, error_message, started_at, completed_at"),
        ("chat_conversations", "user_id", "user_id, title", "execution_contract_id, title"),
        ("chat_messages", "conversation_id", "conversation_id, role, content", "role, content, reaction, task_updates")
    ]

    # Create table for resources
    table_data = [[
        Paragraph("<b>Resource</b>", th_style),
        Paragraph("<b>Parent Filter Field</b>", th_style),
        Paragraph("<b>Required Fields</b>", th_style),
        Paragraph("<b>Allowed Whitelist Fields</b>", th_style)
    ]]

    for res, parent, req, allowed in configs:
        table_data.append([
            Paragraph(f"<b>{res}</b>", td_style),
            Paragraph(parent, td_code),
            Paragraph(req, td_style),
            Paragraph(allowed, td_style)
        ])

    # Table styling
    # Usable width is 504. Allocate: resource = 80, parent = 80, required = 120, allowed = 224
    res_table = Table(table_data, colWidths=[80, 80, 110, 234])
    res_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, bg_light]),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
    ]))
    story.append(res_table)
    story.append(PageBreak())

    # ================= SAMPLE REQUESTS AND RESPONSES =================
    story.append(Paragraph("3. Sample Requests & Responses", h1_style))
    story.append(Paragraph(
        "Below are realistic examples of how an AI agent or developer can interact with the Billionaire Brother "
        "MCP REST API. For all examples, the base URL is: <b>https://thebillionairebrother.com</b>",
        body_style
    ))

    # Example 1: GET users
    story.append(Paragraph("Example 1: List Users (GET)", h2_style))
    story.append(Paragraph("Retrieve users matching a specific filter (e.g. email query).", body_style))
    curl_get_user = (
        "curl -X GET \"https://thebillionairebrother.com/api/mcp/users?email=founder@example.com\" \\\n"
        "  -H \"Authorization: Bearer YOUR_MCP_API_KEY\""
    )
    story.append(Paragraph(curl_get_user.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style))

    res_get_user = (
        "{\n"
        "  \"success\": true,\n"
        "  \"data\": [\n"
        "    {\n"
        "      \"id\": \"usr_8f3c7a2b-81d3-41c6\",\n"
        "      \"email\": \"founder@example.com\",\n"
        "      \"display_name\": \"John Doe\",\n"
        "      \"stripe_customer_id\": \"cus_P92k8sL2\",\n"
        "      \"subscription_status\": \"active\",\n"
        "      \"subscription_plan\": \"scale\",\n"
        "      \"onboarding_complete\": true,\n"
        "      \"created_at\": \"2026-07-01T10:15:30Z\"\n"
        "    }\n"
        "  ]\n"
        "}"
    )
    story.append(Paragraph(res_get_user.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style))

    # Example 2: POST business_profiles
    story.append(Paragraph("Example 2: Create Business Profile (POST)", h2_style))
    story.append(Paragraph("Creates a new profile. Requires <code>user_id</code>, and only whitelisted fields are stored.", body_style))
    
    curl_post_profile = (
        "curl -X POST \"https://thebillionairebrother.com/api/mcp/business_profiles\" \\\n"
        "  -H \"Authorization: Bearer YOUR_MCP_API_KEY\" \\\n"
        "  -H \"Content-Type: application/json\" \\\n"
        "  -d '{\n"
        "    \"user_id\": \"usr_8f3c7a2b-81d3-41c6\",\n"
        "    \"business_name\": \"Apex Agency\",\n"
        "    \"business_state\": \"California\",\n"
        "    \"industry\": \"B2B SaaS Marketing\",\n"
        "    \"current_revenue_range\": \"$10k-$50k/mo\",\n"
        "    \"strengths\": [\"Outbound Sales\", \"Copywriting\"],\n"
        "    \"weaknesses\": [\"Technical SEO\", \"Paid Ads\"],\n"
        "    \"risk_tolerance\": \"Medium\"\n"
        "  }'"
    )
    story.append(Paragraph(curl_post_profile.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style))

    res_post_profile = (
        "{\n"
        "  \"success\": true,\n"
        "  \"data\": {\n"
        "    \"id\": \"prof_03da8b21-42e1-4560\",\n"
        "    \"user_id\": \"usr_8f3c7a2b-81d3-41c6\",\n"
        "    \"business_name\": \"Apex Agency\",\n"
        "    \"business_state\": \"California\",\n"
        "    \"industry\": \"B2B SaaS Marketing\",\n"
        "    \"current_revenue_range\": \"$10k-$50k/mo\",\n"
        "    \"strengths\": [\"Outbound Sales\", \"Copywriting\"],\n"
        "    \"weaknesses\": [\"Technical SEO\", \"Paid Ads\"],\n"
        "    \"risk_tolerance\": \"Medium\",\n"
        "    \"created_at\": \"2026-07-04T02:00:00Z\"\n"
        "  }\n"
        "}"
    )
    story.append(Paragraph(res_post_profile.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style))
    
    story.append(PageBreak())

    # Example 3: PATCH tasks
    story.append(Paragraph("Example 3: Update Task (PATCH)", h2_style))
    story.append(Paragraph("Updates only specific whitelisted fields on a task, such as the status or assignee.", body_style))

    curl_patch_task = (
        "curl -X PATCH \"https://thebillionairebrother.com/api/mcp/tasks/tsk_99a8b7c6-3d2e-4f1a\" \\\n"
        "  -H \"Authorization: Bearer YOUR_MCP_API_KEY\" \\\n"
        "  -H \"Content-Type: application/json\" \\\n"
        "  -d '{\n"
        "    \"status\": \"completed\",\n"
        "    \"assignee\": \"John Doe\"\n"
        "  }'"
    )
    story.append(Paragraph(curl_patch_task.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style))

    res_patch_task = (
        "{\n"
        "  \"success\": true,\n"
        "  \"data\": {\n"
        "    \"id\": \"tsk_99a8b7c6-3d2e-4f1a\",\n"
        "    \"deliverable_id\": \"del_d1f2e3a4-56b7-89c0\",\n"
        "    \"weekly_cycle_id\": \"cyc_w1e2c3d4-5678-90ab\",\n"
        "    \"user_id\": \"usr_8f3c7a2b-81d3-41c6\",\n"
        "    \"title\": \"Implement Email Sequences\",\n"
        "    \"description\": \"Write copy and trigger in CRM\",\n"
        "    \"assignee\": \"John Doe\",\n"
        "    \"status\": \"completed\",\n"
        "    \"due_date\": \"2026-07-10\",\n"
        "    \"sort_order\": 10,\n"
        "    \"updated_at\": \"2026-07-04T02:30:15Z\"\n"
        "  }\n"
        "}"
    )
    story.append(Paragraph(res_patch_task.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style))

    # Example 4: GET Chat Messages with parent filtering
    story.append(Paragraph("Example 4: List Chat Messages with Parent Filter (GET)", h2_style))
    story.append(Paragraph("Get messages belonging to a specific conversation. Note that `chat_messages` requires the `conversation_id` query parameter.", body_style))

    curl_get_messages = (
        "curl -X GET \"https://thebillionairebrother.com/api/mcp/chat_messages?conversation_id=conv_c3f4a5b6\" \\\n"
        "  -H \"Authorization: Bearer YOUR_MCP_API_KEY\""
    )
    story.append(Paragraph(curl_get_messages.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style))

    res_get_messages = (
        "{\n"
        "  \"success\": true,\n"
        "  \"data\": [\n"
        "    {\n"
        "      \"id\": \"msg_7f8a9b0c\",\n"
        "      \"conversation_id\": \"conv_c3f4a5b6\",\n"
        "      \"role\": \"user\",\n"
        "      \"content\": \"Generate my strategy options for this week.\",\n"
        "      \"created_at\": \"2026-07-03T18:00:00Z\"\n"
        "    },\n"
        "    {\n"
        "      \"id\": \"msg_1a2b3c4d\",\n"
        "      \"conversation_id\": \"conv_c3f4a5b6\",\n"
        "      \"role\": \"assistant\",\n"
        "      \"content\": \"Starting the weekly generation job. I will check for insights.\",\n"
        "      \"created_at\": \"2026-07-03T18:00:05Z\"\n"
        "    }\n"
        "  ]\n"
        "}"
    )
    story.append(Paragraph(res_get_messages.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style))

    # Example 5: Chat with Billionaire Brother (POST /api/mcp/chat)
    story.append(Paragraph("Example 5: Chat with Billionaire Brother (POST)", h2_style))
    story.append(Paragraph("Send a message to Derek (the Billionaire Brother) on behalf of a specific user. This loads the user's business profile and tasks, interacts with Gemini, and returns the response.", body_style))

    curl_post_chat = (
        "curl -X POST \"https://thebillionairebrother.com/api/mcp/chat\" \\\n"
        "  -H \"Authorization: Bearer YOUR_MCP_API_KEY\" \\\n"
        "  -H \"Content-Type: application/json\" \\\n"
        "  -d '{\n"
        "    \"user_id\": \"usr_8f3c7a2b-81d3-41c6\",\n"
        "    \"message\": \"Yo Derek, give me a quick 1-sentence tip on outbound marketing.\"\n"
        "  }'"
    )
    story.append(Paragraph(curl_post_chat.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style))

    res_post_chat = (
        "{\n"
        "  \"success\": true,\n"
        "  \"data\": {\n"
        "    \"response\": \"Focus on personalized value-first offers; don't pitch your services, pitch a specific quick-win solution they can't say no to.\",\n"
        "    \"reaction\": \"let's go\",\n"
        "    \"gifUrl\": \"https://media.giphy.com/media/.../giphy.gif\"\n"
        "  }\n"
        "}"
    )
    story.append(Paragraph(res_post_chat.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style))

    story.append(PageBreak())

    # ================= DEPLOYMENT & VERIFICATION =================
    story.append(Paragraph("4. Deployment & Verification", h1_style))
    story.append(Paragraph(
        "To verify or connect new integrations, follow these steps:",
        body_style
    ))
    
    story.append(Paragraph(
        "<b>Step 1: Check Environment Variables</b><br/>"
        "Ensure the server-side environment contains <code>MCP_API_KEY</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>. "
        "These are loaded dynamically in Next.js backend and are never exposed to the client bundle.",
        body_style
    ))

    story.append(Paragraph(
        "<b>Step 2: Dry Run Test (Ping Endpoint)</b><br/>"
        "Run the following curl command in your terminal to verify that the authentication layer correctly responds. "
        "A healthy response will show either successful data retrieval or resource filtering error messages (if a parent filter is missing), "
        "while an incorrect token will result in a 401 Unauthorized error.",
        body_style
    ))

    curl_dry_run = (
        "curl -i -X GET \"https://thebillionairebrother.com/api/mcp/users\" \\\n"
        "  -H \"Authorization: Bearer YOUR_MCP_API_KEY\""
    )
    story.append(Paragraph(curl_dry_run.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style))

    story.append(Spacer(1, 40))
    story.append(Paragraph("<b>End of Document.</b>", body_bold))

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)

if __name__ == "__main__":
    build_pdf()
