import { CreateDialogDto } from "@app/common/dto/create-dialog.dto";
import { DialogResponseDto } from "@app/common/dto/dialog-response.dto";
import { DialogSummaryDto } from "@app/common/dto/dialog-summary.dto";
import { Injectable } from "@nestjs/common";

@Injectable()
export abstract class IDialogService {
    /**
     * Starts a new dialog session.
     * @param role - The role of the user initiating the dialog (MAINTAINER or DEVELOPER).
     * @param dto - The data transfer object containing dialog details.
     * @returns A promise that resolves to the created dialog response.
     */
    public abstract startDialog(role: 'MAINTAINER' | 'DEVELOPER', dto: CreateDialogDto): Promise<DialogResponseDto>;

    /**
     * Retrieves the summary of a dialog session.
     * @param id - The unique identifier of the dialog session.
     * @returns A promise that resolves to the dialog summary.
     */
    public abstract getDialogSummary(id: string): Promise<DialogSummaryDto>;

    /**
     * Integrates detected changes into the dialog session.
     * @param changes - The detected changes to be integrated.
     * @returns A promise that resolves to the result of the integration.
     */
    public abstract integrateChanges(changes: any): Promise<any>;

    /**
     * Saves generated suggestions for the dialog session.
     * @param suggestions - The suggestions to be saved.
     * @returns A promise that resolves to the result of the save operation.
     */
    public abstract saveSuggestions(suggestions: any): Promise<any>;
}
