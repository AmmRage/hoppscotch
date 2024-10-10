# Notice

* use multiple port
* either expose your port or give it a domain name
* host by nginx or caddy

# In the example

| Domain                             | Service     | Container Port |
|------------------------------------|-------------|----------------|
| https://app-hoppscotch.example     | Application | 3000           |
| https://admin-hoppscotch.example   | Admin       | 3100           |
| https://backend-hoppscotch.example | Backend     | 3170           |
