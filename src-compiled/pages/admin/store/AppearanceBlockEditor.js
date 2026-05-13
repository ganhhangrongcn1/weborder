import { useEffect, useState } from "react";
import { AdminBadge, AdminButton, AdminCard, AdminInput, AdminIconButton, AdminSelect } from "../ui/index.js";
import { APP_SECTIONS, FALLBACK_IMAGE, HOME_SECTION_TARGETS } from "./appearanceSettings.utils.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function AppearanceBlockEditor({
  uiDirty = false,
  selectedBlockId,
  selectedBlockMeta,
  selectedNonHeroBlock,
  selectedPopupActionType,
  deliveryBranchApps = [],
  flashSaleWarnings = [],
  selectedHeroBlock,
  selectedActionType,
  topBannerItems,
  uploading,
  uploadInputRef,
  handleBannerUpload,
  updateHomeContent,
  addBannerItem,
  onSaveAppearance,
  setBlockActive,
  draggingHeroId,
  setDraggingHeroId,
  reorderBannerByDrop,
  deleteBanner,
  setSelectedHeroId,
  popupUploadRef,
  handlePopupUpload
}) {
  const [activeDeliveryBranchId, setActiveDeliveryBranchId] = useState("");
  const activeDeliveryBranch = deliveryBranchApps.find(branch => branch.branchId === activeDeliveryBranchId) || deliveryBranchApps[0] || null;
  useEffect(() => {
    if (!deliveryBranchApps.length) {
      setActiveDeliveryBranchId("");
      return;
    }
    if (!deliveryBranchApps.some(branch => branch.branchId === activeDeliveryBranchId)) {
      setActiveDeliveryBranchId(deliveryBranchApps[0].branchId);
    }
  }, [activeDeliveryBranchId, deliveryBranchApps]);
  const updateDeliveryBranchApp = (branchId, appId, patch) => {
    const nextBranchApps = deliveryBranchApps.map(branch => ({
      ...branch,
      apps: branch.apps.map(app => branch.branchId === branchId && app.id === appId ? {
        ...app,
        ...patch
      } : app)
    }));
    updateHomeContent("deliveryApps", {
      branchApps: nextBranchApps
    });
  };
  if (selectedBlockId === "hero") {
    return /*#__PURE__*/_jsx("div", {
      className: "admin-appearance-col admin-appearance-form",
      children: /*#__PURE__*/_jsxs(AdminCard, {
        variant: "elevated",
        className: "admin-appearance-editor",
        children: [/*#__PURE__*/_jsx(EditorHead, {
          title: "Banner \u0111\u1EA7u trang",
          description: "Qu\u1EA3n l\xFD c\xE1c banner con trong block hero.",
          uiDirty: uiDirty,
          onSaveAppearance: onSaveAppearance,
          action: /*#__PURE__*/_jsxs(_Fragment, {
            children: [/*#__PURE__*/_jsx(AdminButton, {
              variant: "secondary",
              onClick: addBannerItem,
              children: "+ Th\xEAm h\xECnh"
            }), /*#__PURE__*/_jsxs("label", {
              className: "admin-switch admin-switch-lg",
              children: [/*#__PURE__*/_jsx("input", {
                type: "checkbox",
                checked: topBannerItems.some(item => item.active !== false),
                onChange: event => setBlockActive("hero", event.target.checked)
              }), /*#__PURE__*/_jsx("span", {})]
            })]
          })
        }), selectedHeroBlock ? /*#__PURE__*/_jsxs(_Fragment, {
          children: [/*#__PURE__*/_jsxs("div", {
            className: "admin-appearance-main-grid",
            children: [/*#__PURE__*/_jsxs("div", {
              className: "admin-appearance-preview",
              children: [/*#__PURE__*/_jsx("strong", {
                children: "Preview banner"
              }), /*#__PURE__*/_jsxs("div", {
                className: "admin-appearance-image-frame",
                children: [/*#__PURE__*/_jsx("img", {
                  src: selectedHeroBlock.image || FALLBACK_IMAGE,
                  alt: selectedHeroBlock.title || "Banner preview",
                  onError: event => {
                    event.currentTarget.src = FALLBACK_IMAGE;
                  }
                }), /*#__PURE__*/_jsxs("label", {
                  className: "admin-appearance-upload-inline",
                  children: [/*#__PURE__*/_jsx("input", {
                    ref: uploadInputRef,
                    type: "file",
                    accept: "image/png,image/jpeg,image/webp",
                    onChange: handleBannerUpload,
                    disabled: uploading
                  }), /*#__PURE__*/_jsx("span", {
                    onClick: event => {
                      event.preventDefault();
                      uploadInputRef.current?.click();
                    },
                    children: uploading ? "Đang xử lý..." : "Thay đổi ảnh"
                  })]
                })]
              }), /*#__PURE__*/_jsx("p", {
                className: "admin-appearance-upload-note",
                children: "M\u1ED7i l\u1EA7n ch\u1ECDn 1 \u1EA3nh, g\u1EE3i \xFD 1200x525px (16:7), k\xE9o/crop tr\u01B0\u1EDBc khi l\u01B0u."
              })]
            }), /*#__PURE__*/_jsx("div", {
              className: "admin-appearance-side",
              children: /*#__PURE__*/_jsxs("div", {
                className: "admin-appearance-group",
                children: [/*#__PURE__*/_jsx("h4", {
                  children: "H\xE0nh \u0111\u1ED9ng khi b\u1EA5m banner"
                }), /*#__PURE__*/_jsxs("div", {
                  className: "admin-appearance-fields",
                  children: [/*#__PURE__*/_jsxs("label", {
                    children: ["Lo\u1EA1i h\xE0nh \u0111\u1ED9ng", /*#__PURE__*/_jsxs(AdminSelect, {
                      value: selectedActionType,
                      onChange: event => updateHomeContent(selectedHeroBlock.id, {
                        actionType: event.target.value,
                        actionTarget: event.target.value === "block" ? selectedHeroBlock.actionTarget || "home" : selectedHeroBlock.actionTarget || "",
                        actionUrl: event.target.value === "url" ? selectedHeroBlock.actionUrl || "" : selectedHeroBlock.actionUrl || ""
                      }),
                      children: [/*#__PURE__*/_jsx("option", {
                        value: "block",
                        children: "Block"
                      }), /*#__PURE__*/_jsx("option", {
                        value: "url",
                        children: "URL"
                      })]
                    })]
                  }), selectedActionType === "block" ? /*#__PURE__*/_jsxs("label", {
                    className: "wide",
                    children: ["Ch\u1ECDn block/section \u0111\xEDch", /*#__PURE__*/_jsx(AdminSelect, {
                      value: selectedHeroBlock.actionTarget || "home",
                      onChange: event => updateHomeContent(selectedHeroBlock.id, {
                        actionTarget: event.target.value
                      }),
                      children: APP_SECTIONS.map(item => /*#__PURE__*/_jsx("option", {
                        value: item.value,
                        children: item.label
                      }, item.value))
                    })]
                  }) : /*#__PURE__*/_jsxs("label", {
                    className: "wide",
                    children: ["URL \u0111\xEDch", /*#__PURE__*/_jsx(AdminInput, {
                      value: selectedHeroBlock.actionUrl || "",
                      onChange: event => updateHomeContent(selectedHeroBlock.id, {
                        actionUrl: event.target.value
                      }),
                      placeholder: "https://..."
                    })]
                  })]
                })]
              })
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "admin-appearance-group",
            children: [/*#__PURE__*/_jsx("h4", {
              children: "Danh s\xE1ch banner trong block \u0111\u1EA7u trang"
            }), /*#__PURE__*/_jsx("div", {
              className: "admin-banner-order-list",
              children: topBannerItems.map((item, index) => /*#__PURE__*/_jsxs("div", {
                draggable: true,
                onDragStart: () => setDraggingHeroId(item.id),
                onDragEnd: () => setDraggingHeroId(""),
                onDragOver: event => event.preventDefault(),
                onDrop: event => {
                  event.preventDefault();
                  reorderBannerByDrop(draggingHeroId, item.id);
                  setDraggingHeroId("");
                },
                className: `admin-banner-order-item ${item.id === selectedHeroBlock.id ? "selected" : ""} ${draggingHeroId === item.id ? "dragging" : ""}`,
                children: [/*#__PURE__*/_jsxs("button", {
                  type: "button",
                  className: "admin-banner-order-main",
                  onClick: () => setSelectedHeroId(item.id),
                  children: [/*#__PURE__*/_jsx("img", {
                    src: item.image || FALLBACK_IMAGE,
                    alt: item.title || "Banner"
                  }), /*#__PURE__*/_jsxs("span", {
                    children: [/*#__PURE__*/_jsx("strong", {
                      children: item.title || `Banner ${index + 1}`
                    }), /*#__PURE__*/_jsxs("small", {
                      children: ["V\u1ECB tr\xED ", index + 1]
                    })]
                  })]
                }), /*#__PURE__*/_jsx("div", {
                  className: "admin-banner-order-actions",
                  children: /*#__PURE__*/_jsx(AdminIconButton, {
                    label: "X\xF3a banner",
                    variant: "danger",
                    onClick: () => deleteBanner(item.id),
                    disabled: topBannerItems.length <= 1,
                    children: "\xD7"
                  })
                })]
              }, item.id))
            })]
          })]
        }) : /*#__PURE__*/_jsx("p", {
          className: "admin-help-text",
          children: "Ch\u01B0a c\xF3 banner hero \u0111\u1EC3 ch\u1EC9nh."
        })]
      })
    });
  }
  return /*#__PURE__*/_jsx("div", {
    className: "admin-appearance-col admin-appearance-form",
    children: /*#__PURE__*/_jsxs(AdminCard, {
      variant: "elevated",
      className: "admin-appearance-editor",
      children: [/*#__PURE__*/_jsx(EditorHead, {
        title: selectedBlockMeta.title,
        description: selectedBlockMeta.placement,
        uiDirty: uiDirty,
        onSaveAppearance: onSaveAppearance,
        action: /*#__PURE__*/_jsxs("label", {
          className: "admin-switch admin-switch-lg",
          children: [/*#__PURE__*/_jsx("input", {
            type: "checkbox",
            checked: selectedNonHeroBlock?.active !== false,
            onChange: event => setBlockActive(selectedBlockId, event.target.checked)
          }), /*#__PURE__*/_jsx("span", {})]
        })
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-appearance-group",
        children: [/*#__PURE__*/_jsx("h4", {
          children: "Th\xF4ng tin block"
        }), selectedBlockId === "cashback" ? /*#__PURE__*/_jsxs("div", {
          className: "admin-appearance-fields",
          children: [/*#__PURE__*/_jsxs("label", {
            className: "wide",
            children: ["Ti\xEAu \u0111\u1EC1", /*#__PURE__*/_jsx(AdminInput, {
              value: selectedNonHeroBlock?.title || "",
              onChange: event => updateHomeContent("cashback", {
                title: event.target.value
              })
            })]
          }), /*#__PURE__*/_jsxs("label", {
            className: "wide",
            children: ["M\xF4 t\u1EA3", /*#__PURE__*/_jsx(AdminInput, {
              value: selectedNonHeroBlock?.subtitle || "",
              onChange: event => updateHomeContent("cashback", {
                subtitle: event.target.value
              })
            })]
          }), /*#__PURE__*/_jsxs("label", {
            children: ["K\xFD hi\u1EC7u icon", /*#__PURE__*/_jsx(AdminInput, {
              value: selectedNonHeroBlock?.iconText || "%",
              onChange: event => updateHomeContent("cashback", {
                iconText: event.target.value
              })
            })]
          })]
        }) : selectedBlockId === "deliveryApps" ? /*#__PURE__*/_jsx(DeliveryAppsEditor, {
          selectedNonHeroBlock: selectedNonHeroBlock,
          deliveryBranchApps: deliveryBranchApps,
          activeDeliveryBranch: activeDeliveryBranch,
          setActiveDeliveryBranchId: setActiveDeliveryBranchId,
          updateHomeContent: updateHomeContent,
          updateDeliveryBranchApp: updateDeliveryBranchApp
        }) : selectedBlockId === "flashSale" ? /*#__PURE__*/_jsx(FlashSaleNotice, {
          flashSaleWarnings: flashSaleWarnings
        }) : selectedBlockId === "popupCampaign" ? /*#__PURE__*/_jsx(PopupCampaignEditor, {
          selectedNonHeroBlock: selectedNonHeroBlock,
          selectedPopupActionType: selectedPopupActionType,
          uploading: uploading,
          popupUploadRef: popupUploadRef,
          handlePopupUpload: handlePopupUpload,
          updateHomeContent: updateHomeContent
        }) : /*#__PURE__*/_jsx("p", {
          className: "admin-help-text",
          children: "Block n\xE0y d\xF9ng d\u1EEF li\u1EC7u \u0111\u1ED9ng t\u1EEB h\u1EC7 th\u1ED1ng. B\u1EA1n ch\u1EC9 c\u1EA7n b\u1EADt/t\u1EAFt v\xE0 s\u1EAFp x\u1EBFp th\u1EE9 t\u1EF1 hi\u1EC3n th\u1ECB."
        })]
      })]
    })
  });
}
function EditorHead({
  title,
  description,
  uiDirty,
  onSaveAppearance,
  action
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-appearance-subhead",
    children: [/*#__PURE__*/_jsxs("div", {
      children: [/*#__PURE__*/_jsx("h3", {
        children: title
      }), /*#__PURE__*/_jsx("p", {
        children: description
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-appearance-head-actions",
      children: [/*#__PURE__*/_jsx(AdminButton, {
        variant: uiDirty ? "primary" : "secondary",
        onClick: onSaveAppearance,
        children: uiDirty ? "Lưu thay đổi" : "Đã đồng bộ"
      }), action]
    })]
  });
}
function DeliveryAppsEditor({
  selectedNonHeroBlock,
  deliveryBranchApps,
  activeDeliveryBranch,
  setActiveDeliveryBranchId,
  updateHomeContent,
  updateDeliveryBranchApp
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-appearance-fields",
    children: [/*#__PURE__*/_jsxs("label", {
      className: "wide",
      children: ["Ti\xEAu \u0111\u1EC1", /*#__PURE__*/_jsx(AdminInput, {
        value: selectedNonHeroBlock?.title || "",
        onChange: event => updateHomeContent("deliveryApps", {
          title: event.target.value
        })
      })]
    }), /*#__PURE__*/_jsxs("label", {
      className: "wide",
      children: ["M\xF4 t\u1EA3", /*#__PURE__*/_jsx(AdminInput, {
        value: selectedNonHeroBlock?.subtitle || "",
        onChange: event => updateHomeContent("deliveryApps", {
          subtitle: event.target.value
        }),
        placeholder: "Ch\u1ECDn chi nh\xE1nh g\u1EA7n b\u1EA1n r\u1ED3i \u0111\u1EB7t qua app quen thu\u1ED9c."
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "wide admin-delivery-app-branches",
      children: [/*#__PURE__*/_jsxs("label", {
        className: "wide",
        children: ["Ch\u1ECDn chi nh\xE1nh \u0111ang ch\u1EC9nh", /*#__PURE__*/_jsx(AdminSelect, {
          value: activeDeliveryBranch?.branchId || "",
          onChange: event => setActiveDeliveryBranchId(event.target.value),
          children: deliveryBranchApps.map(branch => /*#__PURE__*/_jsx("option", {
            value: branch.branchId,
            children: branch.branchName
          }, branch.branchId))
        })]
      }), activeDeliveryBranch ? /*#__PURE__*/_jsx("div", {
        className: "admin-delivery-app-branch",
        children: /*#__PURE__*/_jsx("div", {
          className: "admin-delivery-app-grid",
          children: activeDeliveryBranch.apps.map(app => /*#__PURE__*/_jsxs("div", {
            className: "admin-delivery-app-row",
            children: [/*#__PURE__*/_jsxs("label", {
              className: "admin-switch",
              children: [/*#__PURE__*/_jsx("input", {
                type: "checkbox",
                checked: app.active !== false,
                onChange: event => updateDeliveryBranchApp(activeDeliveryBranch.branchId, app.id, {
                  active: event.target.checked
                })
              }), /*#__PURE__*/_jsx("span", {})]
            }), /*#__PURE__*/_jsx("strong", {
              children: app.name
            }), /*#__PURE__*/_jsx(AdminInput, {
              value: app.url || "",
              onChange: event => updateDeliveryBranchApp(activeDeliveryBranch.branchId, app.id, {
                url: event.target.value
              }),
              placeholder: "https://..."
            })]
          }, `${activeDeliveryBranch.branchId}-${app.id}`))
        })
      }) : /*#__PURE__*/_jsx("p", {
        className: "admin-help-text",
        children: "Ch\u01B0a c\xF3 chi nh\xE1nh \u0111\u1EC3 c\u1EA5u h\xECnh link app."
      })]
    })]
  });
}
function FlashSaleNotice({
  flashSaleWarnings
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-appearance-fields",
    children: [flashSaleWarnings.length ? /*#__PURE__*/_jsxs("div", {
      className: "wide admin-appearance-warning",
      children: [/*#__PURE__*/_jsx("strong", {
        children: "Flash Sale ch\u01B0a hi\u1EC3n th\u1ECB tr\xEAn Customer"
      }), flashSaleWarnings.map(warning => /*#__PURE__*/_jsx("p", {
        children: warning
      }, warning))]
    }) : /*#__PURE__*/_jsxs("div", {
      className: "wide admin-appearance-ok",
      children: [/*#__PURE__*/_jsx("strong", {
        children: "Flash Sale \u0111\u1EE7 \u0111i\u1EC1u ki\u1EC7n hi\u1EC3n th\u1ECB"
      }), /*#__PURE__*/_jsx("p", {
        children: "Customer s\u1EBD th\u1EA5y block n\xE0y khi c\xF3 s\u1EA3n ph\u1EA9m Flash Sale \u0111ang ch\u1EA1y."
      })]
    }), /*#__PURE__*/_jsx("p", {
      className: "wide admin-help-text",
      children: "N\u1ED9i dung Flash Sale \u0111\u01B0\u1EE3c ch\u1EC9nh trong Khuy\u1EBFn m\xE3i > Flashsale. T\u1EA1i \u0111\xE2y b\u1EA1n ch\u1EC9 b\u1EADt/t\u1EAFt v\xE0 k\xE9o th\u1EA3 v\u1ECB tr\xED block tr\xEAn Home."
    })]
  });
}
function PopupCampaignEditor({
  selectedNonHeroBlock,
  selectedPopupActionType,
  uploading,
  popupUploadRef,
  handlePopupUpload,
  updateHomeContent
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-appearance-fields",
    children: [/*#__PURE__*/_jsxs("label", {
      className: "wide",
      children: ["Ti\xEAu \u0111\u1EC1 popup", /*#__PURE__*/_jsx(AdminInput, {
        value: selectedNonHeroBlock?.title || "",
        onChange: event => updateHomeContent("popupCampaign", {
          title: event.target.value
        }),
        placeholder: "V\xED d\u1EE5: \u01AFu \u0111\xE3i h\xF4m nay"
      })]
    }), /*#__PURE__*/_jsxs("label", {
      className: "wide",
      children: ["M\xF4 t\u1EA3 ng\u1EAFn", /*#__PURE__*/_jsx(AdminInput, {
        value: selectedNonHeroBlock?.subtitle || "",
        onChange: event => updateHomeContent("popupCampaign", {
          subtitle: event.target.value
        }),
        placeholder: "V\xED d\u1EE5: Ch\u1EA1m \u0111\u1EC3 xem menu m\u1EDBi"
      })]
    }), /*#__PURE__*/_jsxs("label", {
      children: ["\u0110\u1ED9 tr\u1EC5 hi\u1EC3n th\u1ECB (gi\xE2y)", /*#__PURE__*/_jsx(AdminInput, {
        type: "number",
        min: "0",
        value: Number(selectedNonHeroBlock?.delaySeconds ?? 3),
        onChange: event => updateHomeContent("popupCampaign", {
          delaySeconds: Math.max(0, Number(event.target.value || 0))
        })
      })]
    }), /*#__PURE__*/_jsxs("label", {
      children: ["Hi\u1EC7n l\u1EA1i sau", /*#__PURE__*/_jsxs(AdminSelect, {
        value: Number(selectedNonHeroBlock?.cooldownHours ?? 6),
        onChange: event => updateHomeContent("popupCampaign", {
          cooldownHours: Number(event.target.value)
        }),
        children: [/*#__PURE__*/_jsx("option", {
          value: 0,
          children: "M\u1ED7i phi\xEAn truy c\u1EADp"
        }), /*#__PURE__*/_jsx("option", {
          value: 1,
          children: "1 gi\u1EDD"
        }), /*#__PURE__*/_jsx("option", {
          value: 6,
          children: "6 gi\u1EDD"
        }), /*#__PURE__*/_jsx("option", {
          value: 12,
          children: "12 gi\u1EDD"
        }), /*#__PURE__*/_jsx("option", {
          value: 24,
          children: "24 gi\u1EDD"
        })]
      })]
    }), /*#__PURE__*/_jsxs("label", {
      children: ["Lo\u1EA1i h\xE0nh \u0111\u1ED9ng", /*#__PURE__*/_jsxs(AdminSelect, {
        value: selectedPopupActionType,
        onChange: event => updateHomeContent("popupCampaign", {
          actionType: event.target.value,
          actionTarget: event.target.value === "block" ? selectedNonHeroBlock?.actionTarget || "home" : selectedNonHeroBlock?.actionTarget || "",
          actionUrl: event.target.value === "url" ? selectedNonHeroBlock?.actionUrl || "" : selectedNonHeroBlock?.actionUrl || ""
        }),
        children: [/*#__PURE__*/_jsx("option", {
          value: "block",
          children: "Block"
        }), /*#__PURE__*/_jsx("option", {
          value: "url",
          children: "URL"
        })]
      })]
    }), selectedPopupActionType === "block" ? /*#__PURE__*/_jsxs("label", {
      className: "wide",
      children: ["Ch\u1ECDn \u0111i\u1EC3m \u0111\u1EBFn", /*#__PURE__*/_jsx(AdminSelect, {
        value: selectedNonHeroBlock?.actionTarget || "home",
        onChange: event => updateHomeContent("popupCampaign", {
          actionTarget: event.target.value
        }),
        children: HOME_SECTION_TARGETS.map(item => /*#__PURE__*/_jsx("option", {
          value: item.value,
          children: item.label
        }, item.value))
      })]
    }) : /*#__PURE__*/_jsxs("label", {
      className: "wide",
      children: ["URL \u0111\xEDch", /*#__PURE__*/_jsx(AdminInput, {
        value: selectedNonHeroBlock?.actionUrl || "",
        onChange: event => updateHomeContent("popupCampaign", {
          actionUrl: event.target.value
        }),
        placeholder: "https://..."
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "wide admin-popup-upload",
      children: [/*#__PURE__*/_jsx("strong", {
        children: "\u1EA2nh popup"
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-popup-upload-row",
        children: [/*#__PURE__*/_jsx("img", {
          src: selectedNonHeroBlock?.image || FALLBACK_IMAGE,
          alt: "Popup preview"
        }), /*#__PURE__*/_jsxs("label", {
          className: "admin-popup-upload-trigger",
          children: [/*#__PURE__*/_jsx("input", {
            ref: popupUploadRef,
            type: "file",
            accept: "image/png,image/jpeg,image/webp",
            onChange: handlePopupUpload,
            disabled: uploading
          }), /*#__PURE__*/_jsx("span", {
            children: uploading ? "Đang xử lý..." : "Chọn ảnh popup"
          })]
        })]
      })]
    })]
  });
}