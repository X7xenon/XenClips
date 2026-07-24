import os
import re


DOWNLOADS_DIR = "downloads"

import re

def clean_filename(name: str) -> str:
    # Remove invalid characters
    name = re.sub(r'[<>:"/\\|?*]', "", name)

    # Remove trailing dots/spaces (Windows doesn't allow them)
    name = name.rstrip(" .")

    # Collapse multiple spaces
    name = re.sub(r"\s+", " ", name)

    return name



def create_workspace(video_title: str) -> dict:
    """
    Creates the complete workspace for a video.

    Folder Structure:
    downloads/
    └── Video Title/
        ├── input/
        ├── transcript/
        ├── temp/
        └── clips/
    """

    video_title = clean_filename(video_title)

    workspace = os.path.join(DOWNLOADS_DIR, video_title)

    folders = {
        "workspace": workspace,
        "input": os.path.join(workspace, "input"),
        "transcript": os.path.join(workspace, "transcript"),
        "temp": os.path.join(workspace, "temp"),
        "clips": os.path.join(workspace, "clips"),
    }

    for folder in folders.values():
        os.makedirs(folder, exist_ok=True)

    return folders


def get_video_path(video_title: str) -> str:
    """
    Returns expected input video path.
    """

    video_title = clean_filename(video_title)

    return os.path.join(
        DOWNLOADS_DIR,
        video_title,
        "input",
        f"{video_title}.mp4",
    )


def get_transcript_path(video_title: str) -> str:
    """
    Returns transcript path.
    """

    video_title = clean_filename(video_title)

    return os.path.join(
        DOWNLOADS_DIR,
        video_title,
        "transcript",
        f"{video_title}.txt",
    )


def get_temp_clip_path(video_title: str, clip_number: int) -> str:
    """
    Returns temporary clip path.
    """

    video_title = clean_filename(video_title)

    return os.path.join(
        DOWNLOADS_DIR,
        video_title,
        "temp",
        f"clip_{clip_number}.mp4",
    )


def get_final_clip_path(video_title: str, clip_number: int) -> str:
    """
    Returns final AutoCrop clip path.
    """

    video_title = clean_filename(video_title)

    return os.path.join(
        DOWNLOADS_DIR,
        video_title,
        "clips",
        f"clip_{clip_number}.mp4",
    )


def delete_temp_files(video_title: str):
    """
    Deletes all temporary clips after AutoCrop.
    """

    video_title = clean_filename(video_title)

    temp_folder = os.path.join(
        DOWNLOADS_DIR,
        video_title,
        "temp",
    )

    if not os.path.exists(temp_folder):
        return

    for file in os.listdir(temp_folder):
        file_path = os.path.join(temp_folder, file)

        if os.path.isfile(file_path):
            os.remove(file_path)


if __name__ == "__main__":

    title = "The Psychology of Success"

    folders = create_workspace(title)

    print("Workspace Created!\n")

    for name, path in folders.items():
        print(f"{name:<12} -> {path}")