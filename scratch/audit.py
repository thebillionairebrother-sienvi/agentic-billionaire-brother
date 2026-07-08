import re
import sys
import os
import json

def analyze_html(file_path):
    print(f"Analyzing: {file_path}")
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        sys.exit(1)
        
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    issues = []
    warnings = []

    # 1. HTML5 Doctype Check
    if not re.search(r"<!doctype\s+html>", content, re.IGNORECASE):
        issues.append("Missing HTML5 doctype declaration (<!DOCTYPE html>)")

    # 2. Charset Check
    if not re.search(r"charset\s*=\s*[\"']?utf-8[\"']?", content, re.IGNORECASE):
        warnings.append("Missing or non-UTF-8 charset declaration")

    # 3. Viewport Meta Check
    if not re.search(r"name\s*=\s*[\"']viewport[\"']", content, re.IGNORECASE):
        issues.append("Missing viewport meta tag for responsive design")

    # 4. HTML Lang Check
    if not re.search(r"<html\s+[^>]*lang\s*=", content, re.IGNORECASE):
        issues.append("Missing 'lang' attribute on <html> element")

    # 5. Title Tag Check
    title_match = re.search(r"<title>(.*?)</title>", content, re.IGNORECASE | re.DOTALL)
    if not title_match:
        issues.append("Missing <title> tag")
    else:
        title = title_match.group(1).strip()
        if len(title) < 10:
            warnings.append(f"Title tag is very short ({len(title)} chars): '{title}'")
        elif len(title) > 60:
            warnings.append(f"Title tag is too long ({len(title)} chars, recommend < 60): '{title}'")

    # 6. Meta Description Check
    desc_match = re.search(r"<meta\s+[^>]*name\s*=\s*[\"']description[\"'][^>]*content\s*=\s*[\"'](.*?)[\"']", content, re.IGNORECASE)
    if not desc_match:
        desc_match = re.search(r"<meta\s+[^>]*content\s*=\s*[\"'](.*?)[\"'][^>]*name\s*=\s*[\"']description[\"']", content, re.IGNORECASE)
    
    if not desc_match:
        issues.append("Missing meta description tag")
    else:
        desc = desc_match.group(1).strip()
        if len(desc) < 50:
            warnings.append(f"Meta description is very short ({len(desc)} chars): '{desc}'")
        elif len(desc) > 160:
            warnings.append(f"Meta description is too long ({len(desc)} chars, recommend < 160): '{desc}'")

    # 7. Heading 1 Hierarchy Check
    h1_matches = re.findall(r"<h1[^>]*>.*?</h1>", content, re.IGNORECASE | re.DOTALL)
    if len(h1_matches) == 0:
        issues.append("Missing main heading (<h1>)")
    elif len(h1_matches) > 1:
        warnings.append(f"Multiple <h1> headings found ({len(h1_matches)}). Recommend exactly one <h1> per page.")

    # 8. Images without Alt Attributes
    images = re.findall(r"<img\s+([^>]*?)>", content, re.IGNORECASE)
    images_without_alt = 0
    for img_attrs in images:
        if "alt=" not in img_attrs.lower():
            images_without_alt += 1
    if images_without_alt > 0:
        warnings.append(f"Found {images_without_alt} <img> tag(s) missing an 'alt' attribute")

    # 9. HTTPS Links Check
    http_links = re.findall(r"href\s*=\s*[\"'](http://[^\"']+)[\"']", content, re.IGNORECASE)
    if http_links:
        warnings.append(f"Found {len(http_links)} insecure HTTP link(s), e.g., '{http_links[0]}'")

    # Compile report
    report = {
        "file": file_path,
        "issues": issues,
        "warnings": warnings,
        "issueCount": len(issues),
        "warningCount": len(warnings)
    }
    
    print("\n" + "="*50)
    print("WEB QUALITY & SEO AUDIT REPORT (PYTHON)")
    print("="*50)
    print(f"Target: {file_path}")
    print(f"Critical Issues Found: {report['issueCount']}")
    print(f"Warnings Found: {report['warningCount']}")
    
    if issues:
        print("\n[CRITICAL ISSUES]")
        for i, issue in enumerate(issues, 1):
            print(f"{i}. [CRITICAL] {issue}")
            
    if warnings:
        print("\n[WARNINGS / RECOMMENDATIONS]")
        for i, warn in enumerate(warnings, 1):
            print(f"{i}. [WARNING] {warn}")
            
    print("="*50)
    
    # Save results to a json file in scratch
    out_path = os.path.join(os.path.dirname(file_path), "audit_report.json")
    with open(out_path, "w", encoding="utf-8") as out_f:
        json.dump(report, out_f, indent=2)
    print(f"Saved raw JSON report to: {out_path}")

if __name__ == "__main__":
    target = "downloaded_screen_utf8.html"
    if len(sys.argv) > 1:
        target = sys.argv[1]
    analyze_html(target)
