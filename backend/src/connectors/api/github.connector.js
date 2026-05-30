import BaseConnector from '../base.connector.js'

class GitHubConnector extends BaseConnector {
  constructor() {
    super('github')
    this.baseUrl = 'https://api.github.com'
  }

  /**
   * Fetch billing info from GitHub API.
   * 
   * GitHub doesn't provide traditional invoices via API — it exposes
   * usage/billing data for Actions, Packages, Copilot, and shared storage.
   * We create internal expense records from this data.
   * 
   * @param {Object} credentials - { token: string, orgName?: string }
   * @returns {Promise<Array>} standardized invoice objects
   */
  async fetchInvoices(credentials) {
    const { token, orgName } = credentials

    if (!token) {
      throw Object.assign(new Error('GitHub token is required'), { status: 400 })
    }

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      }

      // If org is provided, get org billing; otherwise get user billing
      if (orgName) {
        return await this._fetchOrgBilling(headers, orgName)
      } else {
        return await this._fetchUserBilling(headers)
      }

    } catch (error) {
      if (error.status) throw error
      console.error(`[GitHub Connector] Error fetching billing:`, error.message)
      throw Object.assign(
        new Error(`Failed to fetch GitHub billing: ${error.message}`),
        { status: 502 }
      )
    }
  }

  async _fetchOrgBilling(headers, orgName) {
    const invoices = []

    // Fetch Actions billing
    const actionsRes = await fetch(
      `${this.baseUrl}/orgs/${orgName}/settings/billing/actions`,
      { headers }
    )
    if (actionsRes.ok) {
      const actions = await actionsRes.json()
      if (actions.total_paid_minutes_used > 0) {
        invoices.push(this._createRecord(
          `github-actions-${orgName}`,
          actions.total_paid_minutes_used * 0.008, // ~$0.008/min avg
          actions,
          'GitHub Actions'
        ))
      }
    } else if (actionsRes.status === 401 || actionsRes.status === 403) {
      throw Object.assign(new Error('Invalid GitHub token or insufficient permissions'), { status: 401 })
    }

    // Fetch Packages billing
    const packagesRes = await fetch(
      `${this.baseUrl}/orgs/${orgName}/settings/billing/packages`,
      { headers }
    )
    if (packagesRes.ok) {
      const packages = await packagesRes.json()
      if (packages.total_paid_gigabytes_bandwidth_used > 0) {
        invoices.push(this._createRecord(
          `github-packages-${orgName}`,
          packages.total_paid_gigabytes_bandwidth_used * 0.50,
          packages,
          'GitHub Packages'
        ))
      }
    }

    // Fetch Shared Storage billing
    const storageRes = await fetch(
      `${this.baseUrl}/orgs/${orgName}/settings/billing/shared-storage`,
      { headers }
    )
    if (storageRes.ok) {
      const storage = await storageRes.json()
      if (storage.estimated_paid_storage_for_month > 0) {
        invoices.push(this._createRecord(
          `github-storage-${orgName}`,
          storage.estimated_paid_storage_for_month * 0.25,
          storage,
          'GitHub Storage'
        ))
      }
    }

    // If no paid usage found, return empty
    if (invoices.length === 0) {
      return [{
        platform: 'github',
        invoiceId: `github-${orgName}-${new Date().toISOString().slice(0, 7)}`,
        amount: 0,
        currency: 'USD',
        date: new Date(),
        pdfUrl: null,
        pdfBuffer: null,
        type: 'fixed',
        rawData: { message: 'No paid usage detected for this billing period' },
      }]
    }

    return invoices
  }

  async _fetchUserBilling(headers) {
    // For individual users, get subscription info
    const res = await fetch(`${this.baseUrl}/user`, { headers })

    if (!res.ok) {
      if (res.status === 401) {
        throw Object.assign(new Error('Invalid GitHub token'), { status: 401 })
      }
      throw new Error(`GitHub API error: ${res.status}`)
    }

    const user = await res.json()

    return [{
      platform: 'github',
      invoiceId: `github-user-${user.login}-${new Date().toISOString().slice(0, 7)}`,
      amount: user.plan?.name === 'pro' ? 4 : 0, // GitHub Pro = $4/mo
      currency: 'USD',
      date: new Date(),
      pdfUrl: null,
      pdfBuffer: null,
      type: 'fixed',
      rawData: {
        login: user.login,
        plan: user.plan,
        note: 'GitHub does not provide PDF invoices via API. Check email or billing page.',
      },
    }]
  }

  _createRecord(id, amount, rawData, label) {
    return {
      platform: 'github',
      invoiceId: `${id}-${new Date().toISOString().slice(0, 7)}`,
      amount: parseFloat(amount.toFixed(2)),
      currency: 'USD',
      date: new Date(),
      pdfUrl: null,
      pdfBuffer: null,
      type: 'fixed',
      rawData: { ...rawData, label },
    }
  }
}

export default GitHubConnector
