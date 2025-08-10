# Use an official FFmpeg base image from the official Docker Hub repository
FROM jrottenberg/ffmpeg:latest

# Set the working directory inside the container
WORKDIR /app

# Install system dependencies including AWS CLI
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install && \
    rm -rf awscliv2.zip aws/

# Copy the ECS script into the container
COPY merge_videos_ecs.sh /app/

# Make the script executable and verify it exists
RUN chmod +x /app/merge_videos_ecs.sh && \
    ls -la /app/ && \
    echo "Script exists and is executable"

# Set the ECS script as entrypoint to ensure it always runs
ENTRYPOINT ["./merge_videos_ecs.sh"]
