# ekol-tnv-notifications

Send push notifications via Pushover when there are available appointments on an eKOL-TNV website. eKOL-TNV is an online service used by many German municipalities.

## Setup

* Fork this repository.
* Download [Pushover](https://pushover.net/), create an account, and [register an application](https://pushover.net/api).
* Set up the following [repository secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository): `PUSHOVER_API_TOKEN`, `PUSHOVER_USER_KEY`.
* Adjust the [configuration file](config.yml) to your needs, i.e. add/remove the services you’d like to make an appointment for.
* Rename `.github/workflows/run.yml.example` to `.github/workflows/run.yml`.
* Done! A scheduled GitHub Action executes the script every 15 minutes on weekdays. You will receive a Pushover notification whenever appointments for the selected services are available.