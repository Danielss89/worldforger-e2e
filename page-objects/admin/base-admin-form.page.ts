import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page.js';

export abstract class BaseAdminFormPage extends BasePage {
  // Common selectors for admin form pages
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly form: Locator;
  readonly pageHeading: Locator;

  constructor(page: Page) {
    super(page);
    this.submitButton = page.getByRole('button', { name: /create|save|submit/i });
    this.cancelButton = page.getByRole('button', { name: /cancel/i });
    this.form = page.locator('form');
    this.pageHeading = page.getByRole('heading').first();
  }

  // Abstract methods to be implemented by specific pages
  abstract readonly createEndpoint: string;
  abstract readonly updateEndpoint: string;

  async fillField(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label).fill(value);
  }

  async clearField(label: string): Promise<void> {
    await this.page.getByLabel(label).clear();
  }

  async selectOption(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label).selectOption(value);
  }

  async checkCheckbox(label: string): Promise<void> {
    await this.page.getByLabel(label).check();
  }

  async uncheckCheckbox(label: string): Promise<void> {
    await this.page.getByLabel(label).uncheck();
  }

  async clickSubmit(): Promise<void> {
    await this.submitButton.click();
  }

  async clickCancel(): Promise<void> {
    await this.cancelButton.click();
  }

  async verifyFieldValue(label: string, expectedValue: string): Promise<void> {
    await expect(this.page.getByLabel(label)).toHaveValue(expectedValue);
  }

  async verifyFieldError(label: string, errorText: string | RegExp): Promise<void> {
    const field = this.page.getByLabel(label);
    const fieldContainer = field.locator('..');
    await expect(fieldContainer.getByText(errorText)).toBeVisible();
  }

  async verifyFormError(errorText: string | RegExp): Promise<void> {
    await expect(this.page.getByText(errorText)).toBeVisible();
  }

  async verifyHeadingVisible(text: string | RegExp): Promise<void> {
    await expect(this.page.getByRole('heading', { name: text })).toBeVisible();
  }

  // File upload helper
  async uploadFile(label: string, filePath: string): Promise<void> {
    await this.page.getByLabel(label).setInputFiles(filePath);
  }

  // Textarea helper
  async fillTextarea(label: string, value: string): Promise<void> {
    const textarea = this.page.getByLabel(label);
    await textarea.fill(value);
  }

  // Rich text editor helper (if using a WYSIWYG editor)
  async fillRichText(selector: string, value: string): Promise<void> {
    const editor = this.page.locator(selector);
    await editor.click();
    await this.page.keyboard.type(value);
  }

  // Date picker helper
  async setDate(label: string, date: string): Promise<void> {
    await this.page.getByLabel(label).fill(date);
  }

  // Number input helper
  async setNumber(label: string, value: number): Promise<void> {
    await this.page.getByLabel(label).fill(value.toString());
  }

  // Toggle/switch helper
  async toggleSwitch(label: string): Promise<void> {
    await this.page.getByLabel(label).click();
  }
}
