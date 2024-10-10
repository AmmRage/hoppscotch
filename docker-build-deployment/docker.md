# Build

```shell
sudo docker buildx build -f ./Dockerfile .
sudo docker buildx build -f ./Dockerfile  -t repo/hop:latest .
```
# Push

```shell
sudo docker push repo/hop:latest
```
