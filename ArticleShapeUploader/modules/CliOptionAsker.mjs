import readline from 'readline';

export const DeleteOldArticleShapesEnum = {
    DELETE: 'd',
    KEEP: 'k',
    QUIT: 'q'
};

export class DeleteOldArticleShapesQuestion {
    getEnum() {
        return DeleteOldArticleShapesEnum;
    }

    getQuestion() {
        return 'Do you want to delete or keep existing (previously configured) article shapes at the PLA service?';
    }

    getExplanations() {
        return {
            [DeleteOldArticleShapesEnum.DELETE]: 'Delete permanently.',
            [DeleteOldArticleShapesEnum.KEEP]: 'Keep existing shapes.',
            [DeleteOldArticleShapesEnum.QUIT]: 'Quit. Abort the process.'
        };
    }

    getDefaultAnswer() {
        return DeleteOldArticleShapesEnum.QUIT;
    }
}


export class CliOptionAsker {
    constructor(question) {
        this.question = question;
        this.charToEnum = this._buildCharToEnumMap();
        this._assertDefaultExistsOrNull();
    }

    _buildCharToEnumMap() {
        let charToEnum = new Map();
        for (const [_, enumVal] of Object.entries(this.question.getEnum())) {
            charToEnum.set(enumVal.toLowerCase(), enumVal);
        }
        return charToEnum;
    }

    _assertDefaultExistsOrNull() {
        const defaultOption = this.question.getDefaultAnswer();
        if (defaultOption === null) {
            return;
        }
        if (Object.values(this.question.getEnum()).includes(defaultOption)) {
            return;
        }
        throw new Error("Default must be one of the enum values.");
    }

    async ask() {
        const readlineInterface = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const inputPrompt = () => {
            const explanations = this.question.getExplanations?.() || {};
            const parts = Object.values(this.question.getEnum()).map(v => {
                const explanation = explanations[v] || '(no explanation)';
                const mark = this.question.getDefaultAnswer() === v ? ' (default)' : '';
                return `  [${v}] - ${explanation}${mark}`;
            });
            return [`${this.question.getQuestion()}`, ...parts, ''].join('\n');
        };

        const validInputs = Object.values(this.question.getEnum());
        const defaultOption = this.question.getDefaultAnswer();

        return new Promise(resolve => {
            const loop = () => {
                readlineInterface.question(
                    `Choose one (${validInputs.join('/')})${defaultOption ? ` [${defaultOption}]` : ''}: `,
                    answer => {
                        const input = answer.trim().toLowerCase();
                        if (!input && defaultOption) {
                            readlineInterface.close();
                            resolve(defaultOption);
                        } else if (this.charToEnum.has(input)) {
                            readlineInterface.close();
                            resolve(this.charToEnum.get(input));
                        } else {
                            console.log('Invalid input.\n');
                            console.log(inputPrompt());
                            loop();
                        }
                    }
                );
            };
            console.log(inputPrompt());
            loop();
        });
    }
}

