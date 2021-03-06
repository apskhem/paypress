import GoogleAppsScriptDB from "./lib.google.appsscriptdb.js";
import GoogleCharts from "./lib.google.charts.js";
import { App } from "./lib.core.js";
import { RootList } from "./app.modules.js";
import { FormPane, GraphSection, MainPane, ConclusionSection, UserRibbonSection } from "./app.panels.js";

export const db = new GoogleAppsScriptDB("https://script.google.com/macros/s/AKfycbx8PNkzqprtcF5xIjbkvHszP6P5ggWwaAsXdB-fpf7g9BA3bbHT/exec");
export const graph = new GoogleCharts("corechart", "line");

// sever side variable(s)
export const user = {
    id: "",
    fullname: "",
    email: "",
    settings: {
        currency: ""
    }
};

export const records = [] as [Date, ...any[]][];
export const detailRecords = [] as any[];

export const balance = {
    final: 0, // The balance that not include calulated result of exp. or inc --- form previous record.
    result: 0 // the balnce that include calulated result of exp. or inc.
};

export const roots = {
    exp: new RootList("exp"),
    inc: new RootList("inc"),
    len: new RootList("len"),
    deb: new RootList("deb")
};

export const colorset = {
    deficit: "#d45079",
    surplus: "#4baea0"
}

class BalPayApp {

    public static start(): void {
        /* initialize */
        UserRibbonSection.todayDateEl.textContent = App.Utils.formatDate(App.Utils.todayDate);
        App.Utils.initCopyRight(document.getElementById("copyright-year") as HTMLElement, 2019);

        /* init charts */
        graph.set("history", "line-chart", {
            "Date": Date,
            "Balance": Number,
            "Expense": Number,
            "Income": Number,
            "Lending": Number,
            "Debt": Number
        }, () => {
            return {
                title: "",
                legend: {position: "bottom"},
                fontName: "Cabin",
                backgroundColor: {fill: "transparent"},
                colors: ["#85C1E9", colorset.deficit, colorset.surplus, "#ffc70f", "#5D6D7E"],
                animation: {
                    duration: 1000,
                    easing: 'out',
                },
            }
        });

        graph.set("summarized-pie", "pie-chart", {
            "list": String,
            "spending": Number
        }, () => {
            return {
                title: "",
                legend: "none",
                pieSliceText: 'label',
                fontName: "Cabin",
                height: document.getElementsByTagName("main")[0].offsetWidth / 2,
                backgroundColor: { fill:"transparent" }
            }
        });

        /* init user-interfaces */
        FormPane.init();

        // collapsible content
        for (const el of document.getElementsByClassName("collapsible-object") as HTMLCollectionOf<HTMLElement>) {
            el.addEventListener("click", function() {
                const nextSiblingEl = el.nextElementSibling as HTMLElement;
                nextSiblingEl.style.maxHeight = !parseInt(nextSiblingEl.style.maxHeight) ? nextSiblingEl.scrollHeight + "px" : "0";
            });
        }

        // section view
        for (const el of document.getElementsByClassName("section-view-grid") as HTMLCollectionOf<HTMLElement>) {
            for (const child of el.children as HTMLCollectionOf<HTMLElement>) {
                child.addEventListener("click", function() {
                    this.parentElement?.getElementsByClassName("viewed")[0].classList.remove("viewed");
            
                    this.classList.add("viewed");
                });
            }
        }

        for (const el of document.getElementById("statistics-view")?.children as HTMLCollectionOf<HTMLElement>) {
            el.addEventListener("click", function() {
                const graphEl = document.getElementById("statistics-chart") as HTMLElement;

                switch (el.textContent) {
                    case "All": graph.render("history", records, graphEl); break;
                    case "This Month": graph.render("history", records.slice(-App.Utils.todayDate.split(".")[2]), graphEl); break;
                    case "This Week": graph.render("history", records.slice(-7), graphEl); break;
                }
            });
        }

        // view mode
        for (const el of document.getElementById("view-mode")?.children as HTMLCollectionOf<HTMLElement>) {
            el.addEventListener("click", function() {
                if (!el.dataset.index) return;

                const detailSectionEl = document.getElementById("details-sections") as HTMLElement;

                for (const el of detailSectionEl.children as HTMLCollectionOf<HTMLElement>) {
                    el.hidden = true;
                }

                (detailSectionEl.children[+el.dataset.index] as HTMLElement).hidden = false;
            });
        }

        /* init database interaction */
        db.defaultResponsefn = (res) => console.log(res);

        db.setResponseAction("SIGNUP", (res) => {
            FormPane.signUpSection.isRequesting = false;

            if (res.err) {
                switch (res.err) {
                    case "id": FormPane.signUpSection.loggingText = "Username is already taken."; break;
                    default: FormPane.signUpSection.loggingText = "Email is already taken.";
                }
            }
            else if (res.done) {
                FormPane.signUpSection.loggingText = "Proceeding is done, please return to sign in.";
            }
        });

        db.setResponseAction("SIGNIN", (res, old) => {
            FormPane.signInSection.isRequesting = false;

            if (res.err || !res.pass) {
                FormPane.signInSection.confirmBtn.textContent = "Username or password is incorrect.";
                return;
            }

            // store user data
            user.id = res.userData.USERID;
            user.fullname = res.userData.FULLNAME;
            user.email = res.userData.EMAIL;
            user.settings = JSON.parse(res.userData.USER_SETTINGS);

            // processing records
            for (const dataRow of res.records) {
                records.push([
                    new Date(...dataRow.DATE.split(".") as []),
                    dataRow.BALANCE,
                    dataRow.EXPENDITURE,
                    dataRow.INCOME,
                    dataRow.LENDING,
                    dataRow.DEBT
                ]);

                detailRecords.push([
                    dataRow.DETAIL_EXPENDITURE,
                    dataRow.DETAIL_INCOME,
                    dataRow.DETAIL_LENDING,
                    dataRow.DETAIL_DEBT
                ]);

                if (res.records.indexOf(dataRow) === res.records.length - 1) { // record list is today
                    roots["exp"].detail = dataRow.DETAIL_EXPENDITURE;
                    roots["inc"].detail = dataRow.DETAIL_INCOME;
                    roots["len"].detail = dataRow.DETAIL_LENDING;
                    roots["deb"].detail = dataRow.DETAIL_DEBT;
                }
                if (res.records.indexOf(dataRow) === res.records.length - 2) { // record list is previous day
                    balance.final = dataRow.BALANCE;
                }
            }

            // display main screen
            MainPane.present = true;
            FormPane.present = false;

            // functions after completing the data request precess
            RootList.UpdateBalance();
            ConclusionSection.updateConclusion();
            GraphSection.setActiveModeTo(1);

            // init user settings
            document.head.title = "BalPay - " + user.fullname;
            UserRibbonSection.fullNameEl.textContent = user.fullname;
            FormPane.signInSection.confirmBtn.textContent = "Sign In";

            // close all newly created list
            for (const expandable of document.getElementsByClassName("collapsible-object") as HTMLCollectionOf<HTMLLIElement>) {
                const nextSiblingEl = expandable.nextElementSibling as HTMLElement;
                nextSiblingEl.style.maxHeight = "0";
            }

            // save current user
            if (old) {
                localStorage.setItem("userid", old.userid);
                localStorage.setItem("password", old.password);
            }

            document.getElementById("loading-page")?.remove();
        });

        db.setDataRequestForm("UPDATE", () => {
            return {
                "user": user.id,
                "date": App.Utils.todayDate,
                "balance": balance.result,
                "expenditure": roots["exp"].total,
                "income": roots["inc"].total,
                "lending": roots["len"].total,
                "debt": roots["deb"].total,
                "detail_expenditure": roots["exp"].detail,
                "detail_income": roots["inc"].detail,
                "detail_lending": roots["len"].detail,
                "detail_debt": roots["deb"].detail
            }
        });

        MainPane.init();
        UserRibbonSection.init();

        if (!this.checkLocalStorage()) {
            document.getElementById("loading-page")?.remove();
        }
    }

    public static checkLocalStorage(): boolean {
        const userid = localStorage.getItem("userid");
        const password = localStorage.getItem("password");

        if (!userid || !password) return false;

        db.doGetRequest("SIGNIN", { userid, password });

        return true;
    }
}

window.onload = () => BalPayApp.start();