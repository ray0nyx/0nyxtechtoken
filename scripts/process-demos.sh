#!/bin/bash

# Create necessary directories
mkdir -p public/images/demos/raw
mkdir -p public/images/demos/processed

# Function to process video
process_video() {
    input=$1
    output=$2
    
    # Process video:
    # - Scale to 1280x720
    # - Limit to 15 seconds
    # - Optimize for web
    # - Add fade in/out
    ffmpeg -i "$input" \
        -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:-1:-1:color=black,fade=in:0:30,fade=out:450:30" \
        -t 15 \
        -c:v libx264 \
        -preset slow \
        -crf 22 \
        -movflags +faststart \
        -an \
        "$output"
}

# Function to create screenshot from video
create_screenshot() {
    input=$1
    output=$2
    
    # Extract frame at 2 seconds and optimize
    ffmpeg -i "$input" -ss 00:00:02 -vframes 1 -vf "scale=1280:720" "$output"
    
    # Optimize screenshot
    convert "$output" -quality 85 -strip "$output"
}

# Process each demo video
for video in public/images/demos/raw/*.mp4; do
    if [ -f "$video" ]; then
        filename=$(basename "$video")
        name="${filename%.*}"
        
        echo "Processing $filename..."
        
        # Process video
        process_video "$video" "public/images/demos/processed/${name}-demo.mp4"
        
        # Create screenshot
        create_screenshot "$video" "public/images/demos/${name}-screenshot.png"
    fi
done

echo "Done processing demo videos and screenshots!" 