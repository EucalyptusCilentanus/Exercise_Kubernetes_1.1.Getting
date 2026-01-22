# Exercise 1.1 - Log output

## Tag / Release
This tag corresponds to **Exercise 1.1**.

Submission entry points:
- Tree: `/tree/1.1`
- Release: `/releases/tag/1.1`

## Purpose
This application generates a random UUID once at startup, keeps it in memory, and prints it every 5 seconds together with an ISO 8601 timestamp.

Example output:
2020-03-30T12:15:17.705Z: 8523ecb1-c716-4cb6-a044-b9e83bb98e43  
2020-03-30T12:15:22.705Z: 8523ecb1-c716-4cb6-a044-b9e83bb98e43

## Project location
- Application source and Dockerfile: `1.1/log-output/`
- Kubernetes manifest (Deployment): `1.1/log-output/manifests/deployment.yaml`

## Container image
- `docker.io/helstest99/dwk-log-output:1.1`

## Prerequisites
- A working Kubernetes cluster
- `kubectl` configured to point to the correct cluster/context

## Build and push (optional)
Run from the repository root:

```bash
docker build -t docker.io/helstest99/dwk-log-output:1.1 1.1/log-output
docker push docker.io/helstest99/dwk-log-output:1.1
