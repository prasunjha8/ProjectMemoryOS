import json
import io
import re
from typing import Dict, Any, List
import PyPDF2


class ParserService:
    @staticmethod
    def parse_text(content: str) -> str:
        """
        Trims and sanitizes plain text files.
        """
        return content.strip()

    @staticmethod
    def parse_markdown(content: str) -> Dict[str, Any]:
        """
        Parses Markdown files. Extracts a potential title from the first H1 header 
        and returns the sanitized content.
        """
        lines = content.split("\n")
        title = "Untitled Note"
        
        # Try to find the first H1 header for title
        for line in lines:
            line_stripped = line.strip()
            if line_stripped.startswith("# "):
                title = line_stripped.replace("# ", "", 1).strip()
                break
                
        return {
            "title": title,
            "text_content": content.strip()
        }

    @staticmethod
    def parse_pdf(file_bytes: bytes) -> str:
        """
        Extracts raw text from PDF file bytes using PyPDF2.
        """
        pdf_file = io.BytesIO(file_bytes)
        reader = PyPDF2.PdfReader(pdf_file)
        text_runs = []
        
        for page_num in range(len(reader.pages)):
            page = reader.pages[page_num]
            text = page.extract_text()
            if text:
                text_runs.append(text)
                
        return "\n\n".join(text_runs).strip()

    @staticmethod
    def parse_json_chat(content: str) -> Dict[str, Any]:
        """
        Parses JSON exports from chat interfaces.
        Supports standard array format: [{"role": "user", "content": "..."}]
        or nested shapes (ChatGPT/Claude export formats).
        Converts chats to a readable transcript format:
        [User]: Hello
        [Assistant]: Hi there
        """
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON content: {str(e)}")

        title = "Pasted Conversation"
        transcript = []

        # Case 1: Simple list of messages
        if isinstance(data, list):
            for idx, msg in enumerate(data):
                # Try to extract role and content
                role = msg.get("role", msg.get("sender", "unknown")).capitalize()
                text = msg.get("content", msg.get("text", msg.get("message", "")))
                
                # If first message is user query, set as title
                if idx == 0 and role.lower() == "user":
                    # Take first 50 chars as title
                    clean_title = re.sub(r'[^\w\s\-\(\)]', '', text)
                    title = f"Chat: {clean_title[:50].strip()}..."
                
                if role and text:
                    transcript.append(f"[{role}]: {text}")
        
        # Case 2: Object containing a conversation tree/list (e.g. ChatGPT export structure)
        elif isinstance(data, dict):
            # ChatGPT export: check for 'title' and 'mapping' or 'messages'
            title = data.get("title", title)
            
            # Simple messages array in dict
            messages = data.get("messages", [])
            if messages and isinstance(messages, list):
                for msg in messages:
                    role = msg.get("role", "").capitalize()
                    text = msg.get("content", {}).get("parts", [""])[0] if isinstance(msg.get("content"), dict) else msg.get("content", "")
                    if role and text:
                        transcript.append(f"[{role}]: {text}")
            
            # Direct mapping structures
            elif "mapping" in data:
                # Iterate nodes in chat tree
                for node_id, node in data["mapping"].items():
                    message = node.get("message")
                    if message:
                        author = message.get("author", {})
                        role = author.get("role", "unknown").capitalize()
                        content_obj = message.get("content", {})
                        parts = content_obj.get("parts", [])
                        text = " ".join([p for p in parts if isinstance(p, str)])
                        if role and text.strip():
                            transcript.append(f"[{role}]: {text.strip()}")
            
            # Claude export formats (often has conversation details)
            elif "chat_messages" in data:
                for msg in data["chat_messages"]:
                    role = msg.get("sender", "unknown").capitalize()
                    text = msg.get("text", "")
                    if role and text:
                        transcript.append(f"[{role}]: {text}")

        # If we failed to parse anything structured, treat it as clean dump
        if not transcript:
            return {
                "title": title,
                "text_content": content.strip()
            }
            
        return {
            "title": title,
            "text_content": "\n\n".join(transcript)
        }
        
    @classmethod
    def parse_file(cls, filename: str, content_bytes: bytes) -> Dict[str, Any]:
        """
        Route to specific parser based on extension/filename.
        """
        ext = filename.split(".")[-1].lower()
        
        if ext == "pdf":
            text = cls.parse_pdf(content_bytes)
            # Use filename without extension as title
            title = ".".join(filename.split(".")[:-1])
            return {"title": title, "text_content": text}
            
        # For text based files, decode bytes to string
        try:
            content_str = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                content_str = content_bytes.decode("latin-1")
            except Exception:
                raise ValueError("Could not decode file content as text.")
                
        if ext == "json":
            return cls.parse_json_chat(content_str)
        elif ext in ["md", "markdown"]:
            return cls.parse_markdown(content_str)
        else:
            # Default text
            title = ".".join(filename.split(".")[:-1])
            return {"title": title, "text_content": cls.parse_text(content_str)}
