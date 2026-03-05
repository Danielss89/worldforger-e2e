import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page.js';

export abstract class BaseAdminListPage extends BasePage {
  // Common selectors for admin list pages
  readonly searchInput: Locator;
  readonly createButton: Locator;
  readonly table: Locator;
  readonly pageHeading: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByRole('textbox', { name: /search/i });
    this.createButton = page.getByRole('button', { name: /create|add/i });
    this.table = page.getByRole('grid');
    this.pageHeading = page.getByRole('heading').first();
  }

  // Abstract methods to be implemented by specific pages
  abstract readonly listEndpoint: string;
  abstract readonly itemNameField: string;

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    // Wait for debounce
    await this.page.waitForTimeout(300);
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.page.waitForTimeout(300);
  }

  async clickCreate(): Promise<void> {
    await this.createButton.click();
  }

  async getRowByName(name: string): Promise<Locator> {
    return this.page.getByRole('row', { name: new RegExp(name, 'i') });
  }

  async getRowHeader(name: string): Promise<Locator> {
    return this.page.getByRole('rowheader', { name });
  }

  async clickEditOnRow(name: string): Promise<void> {
    const row = await this.getRowByName(name);
    await row.getByRole('button', { name: /edit/i }).click();
  }

  async clickDeleteOnRow(name: string): Promise<void> {
    const row = await this.getRowByName(name);
    await row.getByRole('button', { name: /delete/i }).click();
  }

  async confirmDelete(): Promise<void> {
    // Find the delete button in the confirmation dialog
    const dialog = this.page.getByRole('alertdialog').or(this.page.getByRole('dialog'));
    await dialog.getByRole('button', { name: /delete/i }).click();
  }

  async cancelDelete(): Promise<void> {
    const dialog = this.page.getByRole('alertdialog').or(this.page.getByRole('dialog'));
    await dialog.getByRole('button', { name: /cancel/i }).click();
  }

  async verifyItemVisible(name: string): Promise<void> {
    await expect(this.page.getByRole('rowheader', { name })).toBeVisible();
  }

  async verifyItemNotVisible(name: string): Promise<void> {
    await expect(this.page.getByRole('rowheader', { name })).not.toBeVisible();
  }

  async verifyHeadingVisible(text: string | RegExp): Promise<void> {
    await expect(this.page.getByRole('heading', { name: text })).toBeVisible();
  }

  async verifyEmptyState(): Promise<void> {
    // Most admin pages show "No X found" or similar empty state
    await expect(this.page.getByText(/no .* found|no results/i)).toBeVisible();
  }

  async getTableRowCount(): Promise<number> {
    const rows = this.page.getByRole('row');
    // Subtract 1 for header row
    return (await rows.count()) - 1;
  }

  // Pagination helpers
  async goToNextPage(): Promise<void> {
    await this.page.getByRole('button', { name: /next/i }).click();
  }

  async goToPreviousPage(): Promise<void> {
    await this.page.getByRole('button', { name: /previous|prev/i }).click();
  }

  // Sort helpers
  async sortByColumn(columnName: string): Promise<void> {
    await this.page.getByRole('columnheader', { name: columnName }).click();
  }
}
